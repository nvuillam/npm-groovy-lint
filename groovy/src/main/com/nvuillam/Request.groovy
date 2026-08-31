package com.nvuillam

import groovy.ant.AntBuilder
import groovy.transform.CompileDynamic
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.regex.Matcher
import java.util.regex.Pattern
import org.codehaus.groovy.ant.FileScanner
import org.codenarc.CodeNarc
import org.codenarc.util.CodeNarcVersion
import org.slf4j.Logger
import org.slf4j.LoggerFactory

/**
 * Represents a lint request.
 */
@CompileDynamic
class Request {

    private static final Pattern ARG_PATTERN = ~/^-([^=]+)=(.*)$/ // -name=value
    private static final Logger LOGGER = LoggerFactory.getLogger(Request)
    static final List<String> HELP_ARGS = ['-help']
    static final List<String> VERSION_ARGS = ['-version']

    /**
     * Returns the CodeNarc version.
     */
    static String codeNarcVersion() {
        return "CodeNarc version ${CodeNarcVersion.getVersion()}"
    }

    /**
     * Returns CodeNarc help information.
     */
    static String codeNarcHelp() {
        return CodeNarc.HELP
    }

    List<String> codeNarcArgs
    String codeNarcBaseDir
    String[] codeNarcIncludes
    String[] codeNarcExcludes
    boolean parse
    String[] fileList
    String requestKey
    Integer parallelism

    Request() {
        this.codeNarcArgs = []
        this.codeNarcBaseDir = '.'
        this.codeNarcIncludes = ['**/*.groovy']
        this.codeNarcExcludes = []
        this.parse = false
        this.fileList = []
        this.requestKey = null
        this.parallelism = null
    }

    /**
     * Create a new request from command line arguments.
     *
     * @param parse enables / disables parsing.
     * @param args the command line arguments.
     */
    Request(boolean parse, List<String> files, List<String> args) {
        this()
        this.parse = parse
        this.fileList = files
        this.codeNarcArgs = args

        // Parse arguments to provide the ability to check for errors.
        args.each { arg ->
            Matcher matcher = ARG_PATTERN.matcher(arg)
            if (!matcher.matches()) {
                throw new IllegalArgumentException("Invalid argument format: [$arg]")
            }
        }
        resolveFromCodeNarcArgs()
    }

    /**
     * Fill basedir/includes/excludes/sourcefiles from the raw CodeNarc arguments, for any
     * field still holding its default value.
     *
     * An HTTP request built by `--codenarcargs` carries everything inside codeNarcArgs and
     * none of the explicit JSON fields (Jackson goes through the no-arg constructor), so
     * without this the server would scan its own working directory with the default
     * '**&#47;*.groovy' pattern instead of honoring the caller's -basedir/-includes - and
     * silently produce an empty result. Explicitly provided fields win: a field that no
     * longer holds its default is left untouched.
     */
    private void resolveFromCodeNarcArgs() {
        codeNarcArgs.each { arg ->
            Matcher matcher = ARG_PATTERN.matcher(arg)
            if (!matcher.matches()) {
                return
            }

            String name = matcher.group(1)
            String value = matcher.group(2)

            switch (name) {
                case 'basedir':
                    if (codeNarcBaseDir == '.') {
                        LOGGER.debug('Request -{}: {}', name, value)
                        codeNarcBaseDir = value
                    }
                    break
                case 'includes':
                    if (codeNarcIncludes.length == 1 && codeNarcIncludes[0] == '**/*.groovy') {
                        LOGGER.debug('Request -{}: {}', name, value)
                        codeNarcIncludes = value.split(',')
                    }
                    break
                case 'excludes':
                    if (codeNarcExcludes.length == 0) {
                        LOGGER.debug('Request -{}: {}', name, value)
                        codeNarcExcludes = value.split(',')
                    }
                    break
                case 'sourcefiles':
                    if (!fileList) {
                        LOGGER.debug('Request -{}: {}', name, value)
                        fileList = value.split(',')
                    }
                    break
            }
        }
    }

    /**
     * Process the request, using a same-thread executor as the analysis pool.
     *
     * Kept for callers that have no pool of their own to offer (e.g. tests exercising
     * Request in isolation). The pool is shut down once processing completes, otherwise
     * every call through this overload leaks a thread.
     *
     * @param response the response to populate.
     */
    void process(Response response) {
        ExecutorService pool = Executors.newSingleThreadExecutor()
        try {
            process(response, new LintContext(pool, null))
        } finally {
            pool.shutdownNow()
        }
    }

    /**
     * Process the request, with no cancellation handle to register partition futures on.
     *
     * @param response the response to populate.
     * @param ctx collaborators (the analysis thread pool, and the result cache once Task 5 lands).
     */
    void process(Response response, LintContext ctx) {
        process(response, ctx, null)
    }

    /**
     * Process the request.
     *
     * @param response the response to populate.
     * @param ctx collaborators (the analysis thread pool, and the result cache once Task 5 lands).
     * @param handle registers this request's partition futures so a duplicate requestKey can
     *        cancel them; may be null when there is no cancellation tracking (e.g. tests
     *        exercising Request in isolation, or the one-shot CLI call).
     */
    void process(Response response, LintContext ctx, AnalysisPartitioner.RequestHandle handle) {
        if (codeNarcArgs == VERSION_ARGS) {
            response.setStdout(codeNarcVersion())
            return
        }

        if (codeNarcArgs == HELP_ARGS) {
            response.setStdout(codeNarcHelp())
            return
        }

        // A request cancelled before reaching AnalysisPartitioner (e.g. while another
        // duplicate was still being handled) should not even start listing/parsing files.
        if (Thread.currentThread().isInterrupted()) {
            throw new InterruptedException('Cancelled before processing')
        }

        // An HTTP --codenarcargs request carries basedir/includes/excludes only inside the
        // raw args: apply them to the fields the rest of this method relies on.
        resolveFromCodeNarcArgs()

        // Detect parse errors if requested.
        response.fileList = listFiles()
        response.parseErrors = parseFiles(response.fileList)

        // Strip any -includes the caller supplied: partitions supply their own.
        List<String> baseArgs = codeNarcArgs.findAll { !it.startsWith('-includes=') }

        List<String> relativePaths = response.fileList.collect { String absolute ->
            relativise(absolute)
        }

        List<String> orderedKeys = orderedResultKeys(response.fileList)

        // Any report other than -report=json:stdout is produced by CodeNarc actually
        // executing - written straight to disk (file destination, or no destination at all:
        // CodeNarc then writes its default report file), or captured from stdout in a format
        // ResultMerger cannot merge (e.g. -report=xml:stdout). None of these can be
        // reconstructed from cached per-file violations. Bypass the cache entirely in that
        // case - neither read from it nor write to it - so CodeNarc always actually runs and
        // the report is always complete, instead of a fully-cached request silently skipping
        // execution and never producing it. AnalysisPartitioner.choosePartitionCount uses
        // the same check to force a single partition for these requests.
        boolean nonMergeableReport = AnalysisPartitioner.hasNonMergeableReport(baseArgs)

        // A path CodeNarc's comma-separated -includes cannot express: a comma in the path
        // (CodeNarc splits the value on commas), or a file that did not resolve under the
        // canonical basedir (e.g. a symlink pointing outside it), whose absolute path is
        // meaningless as an ant pattern relative to basedir. Rebuilding -includes from such
        // paths would silently drop the file from the analysis, so fall back to the caller's
        // own include/exclude patterns instead - the pre-partitioning behaviour - and skip
        // the cache, whose per-file bookkeeping relies on the rebuilt includes.
        boolean unsafeIncludePaths = relativePaths.any { String relative -> isUnsafeIncludePath(relative) }

        boolean bypassCache = nonMergeableReport || unsafeIncludePaths

        Map<String, List<Map>> cached = [:]
        List<String> toAnalyse = relativePaths
        Map<String, String> keyByRelative = [:]
        Map<String, File> fileByRelative = [:]
        String fingerprint = null

        if (ctx.cache != null && !bypassCache) {
            fingerprint = ctx.cache.fingerprint(baseArgs)
            toAnalyse = []
            relativePaths.eachWithIndex { String relative, int i ->
                File file = new File(response.fileList[i])
                String key = ctx.cache.keyFor(fingerprint, relative, file)
                keyByRelative.put(relative, key)
                fileByRelative.put(relative, file)
                List<Map> hit = ctx.cache.get(key)
                if (hit != null) {
                    cached.put(packageFileKey(relative), hit)
                } else {
                    toAnalyse << relative
                }
            }
        }

        LOGGER.debug('Calling CodeNarc with base args: {}', baseArgs)
        AnalysisPartitioner.AnalysisOutcome outcome
        if (unsafeIncludePaths) {
            LOGGER.debug('Includes cannot be rebuilt from file paths (comma or out-of-basedir path): using caller patterns {}',
                codeNarcIncludes)
            outcome = AnalysisPartitioner.analysePatterns(codeNarcIncludes as List<String>, baseArgs)
        } else {
            outcome = AnalysisPartitioner.analyse(toAnalyse, baseArgs, parallelism, ctx.pool, handle)
        }

        // Store freshly computed results before merging.
        String template = outcome.reports ? outcome.reports[0] : null
        if (ctx.cache != null && !bypassCache) {
            storeResults(outcome.reports, keyByRelative, fileByRelative, fingerprint, ctx.cache)
            if (template != null) {
                ctx.cache.putTemplate(fingerprint, template)
            } else {
                // Every file was a cache hit: reuse the stored template so the merged
                // report still carries the 'codeNarc' and 'rules' blocks Node requires.
                template = ctx.cache.getTemplate(fingerprint)
            }
            response.cacheHits = ctx.cache.hits
            response.cacheMisses = ctx.cache.misses
        }

        response.partitionCount = outcome.partitionCount
        response.setJsonResult(ResultMerger.merge(outcome.reports, cached, template, orderedKeys))
        if (outcome.stdoutReport != null) {
            // A non-JSON captured report (e.g. -report=xml:stdout) is a different format
            // ResultMerger cannot parse as JSON: surface it separately, mirroring the
            // original single-threaded implementation's json/else branch.
            response.setStdout(outcome.stdoutReport)
        }
    }

    /**
     * Convert an absolute path into a CodeNarc basedir-relative ant path.
     *
     * A path that does not resolve under the canonical basedir (e.g. a symlink pointing
     * outside it) is returned as its absolute forward-slash form - which
     * isUnsafeIncludePath() then flags, since such a path cannot be expressed as an ant
     * pattern relative to basedir.
     */
    private String relativise(String absolutePath) {
        String base = new File(codeNarcBaseDir).canonicalPath
        String target = new File(absolutePath).canonicalPath
        if (target.startsWith(base)) {
            return target.substring(base.length()).replace('\\', '/').replaceAll('^/', '')
        }
        return target.replace('\\', '/')
    }

    /**
     * True when this basedir-relative path cannot be safely put into a rebuilt
     * comma-separated -includes value: it contains a comma (CodeNarc splits on commas), or
     * it is not relative at all (relativise() fell back to the absolute path because the
     * file lives outside the canonical basedir).
     */
    private static boolean isUnsafeIncludePath(String relativePath) {
        return relativePath.contains(',') ||
            relativePath.startsWith('/') ||
            (relativePath.length() > 1 && relativePath.charAt(1) == (char)':') // Windows drive letter
    }

    /**
     * Parse groovy files to detect errors if parsing is enabled.
     *
     * @param fileList the list of files to parse
     * @return the map of files to errors
     */
    private Map<String, List<String>> parseFiles(List<String> fileList) {
        LOGGER.debug('parseFiles: parse={}, fileList={}', parse, fileList)
        if (!parse) {
            return [:]
        }
        return SourceParser.parseFiles(fileList)
    }

    /**
     * Build the "packagePath|fileName" keys ResultMerger uses to order its output, in the same
     * order as the request's own file list, so the merged report keeps the file processing order
     * a caller would see without the merger.
     *
     * @param absoluteFiles the absolute file paths, in request order (as produced by listFiles())
     * @return the ordered list of "packagePath|fileName" keys, relative to codeNarcBaseDir
     */
    private List<String> orderedResultKeys(List<String> absoluteFiles) {
        // Use the same canonical-path relativisation as the cache lookup and the rebuilt
        // -includes (see relativise), so cache keys, merge keys and analysis patterns all
        // agree on the same relative path for the same file - URI.relativize, used here
        // before, does not canonicalise and so could disagree on symlinked or non-normalised
        // paths.
        return absoluteFiles.collect { String absolutePath ->
            return packageFileKey(relativise(absolutePath))
        }
    }

    /**
     * Build the "packagePath|fileName" key ResultMerger uses to identify a file, from a
     * path relative to codeNarcBaseDir. Shared by orderedResultKeys() (merge ordering) and
     * the cache lookup in process() (cached violations), so both agree on the same key for
     * the same file.
     */
    private String packageFileKey(String relativePath) {
        int sep = relativePath.lastIndexOf('/')
        String pkgPath = sep >= 0 ? relativePath.substring(0, sep) : ''
        String fileName = sep >= 0 ? relativePath.substring(sep + 1) : relativePath
        return "${pkgPath}|${fileName}"
    }

    /**
     * Store per-file violations from freshly produced reports into the cache.
     *
     * The cache key was computed from the file content BEFORE the analysis, but CodeNarc
     * re-reads the file from disk DURING the analysis: a write landing in between (e.g. an
     * editor saving while a lint-on-save request is in flight) would cache the new content's
     * violations under the old content's key, and serve them forever. Guard against it by
     * re-hashing the file after the analysis and only storing when the key is unchanged - a
     * file that changed mid-analysis simply is not cached, and the next request recomputes it.
     */
    private void storeResults(List<String> reports, Map<String, String> keyByRelative,
                              Map<String, File> fileByRelative, String fingerprint, ResultCache cache) {
        com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper()
        reports.findAll { it }.each { String report ->
            Map parsed = mapper.readValue(report, Map)
            (parsed.packages ?: []).each { Map pkg ->
                String pkgPath = pkg.path ?: ''
                (pkg.files ?: []).each { Map file ->
                    String relative = pkgPath ? "${pkgPath}/${file.name}" : file.name.toString()
                    String key = keyByRelative.get(relative)
                    if (key == null) {
                        return
                    }
                    File sourceFile = fileByRelative.get(relative)
                    String keyAfterAnalysis = null
                    try {
                        if (sourceFile != null && sourceFile.exists()) {
                            keyAfterAnalysis = cache.keyFor(fingerprint, relative, sourceFile)
                        }
                    } catch (Throwable ignored) {
                        // Unreadable file: treat as changed, do not cache.
                    }
                    if (keyAfterAnalysis == key) {
                        cache.put(key, (file.violations ?: []) as List<Map>)
                    } else {
                        LOGGER.debug('File {} changed during analysis: result not cached', relative)
                    }
                }
            }
        }
    }

    /**
     * List files to be parsed / linted.
     *
     * @return the list of file names to be parsed / linted
     * @throws FileNotFoundException if the base directory doesn't exist
     */
    private List<String> listFiles() throws FileNotFoundException {
        List<String> files = []

        if (fileList) {
            // Source files are specified, use them only.
            LOGGER.debug('listFiles fileList: {}', fileList)
            for (String file in fileList) {
                File f = new File(file)
                files << f.getAbsolutePath()
            }
            return files
        }

        // Ant style pattern is used: list all files
        LOGGER.debug('listFiles ant file scanner in {}, includes {}, excludes {}',
            codeNarcBaseDir,
            codeNarcIncludes,
            codeNarcExcludes,
        )

        File dir = new File(codeNarcBaseDir)
        if (!dir.exists()) {
            // Base directory doesn't exist, throw to avoid overhead of running CodeNarc.
            throw new FileNotFoundException(codeNarcBaseDir)
        }

        AntBuilder ant = new AntBuilder()
        FileScanner scanner = ant.fileScanner {
            fileset(dir: codeNarcBaseDir) {
                codeNarcIncludes.each { includeExpr ->
                    include(name: includeExpr)
                }
                codeNarcExcludes.each { excludeExpr ->
                    exclude(name: excludeExpr)
                }
            }
        }

        for (f in scanner) {
            files << f.getAbsolutePath()
        }

        LOGGER.debug('listFiles files: {}', files)

        return files
    }

}
