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

            String name = matcher.group(1)
            String value = matcher.group(2)

            switch (name) {
                case 'basedir':
                    LOGGER.debug('Request -{}: {}', name, value)
                    codeNarcBaseDir = value
                    break
                case 'includes':
                    LOGGER.debug('Request -{}: {}', name, value)
                    codeNarcIncludes = value.split(',')
                    break
                case 'excludes':
                    LOGGER.debug('Request -{}: {}', name, value)
                    codeNarcExcludes = value.split(',')
                    break
                case 'sourcefiles':
                    LOGGER.debug('Request -{}: {}', name, value)
                    fileList = value.split(',')
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

        // Detect parse errors if requested.
        response.fileList = listFiles()
        response.parseErrors = parseFiles(response.fileList)

        // Strip any -includes the caller supplied: partitions supply their own.
        List<String> baseArgs = codeNarcArgs.findAll { !it.startsWith('-includes=') }

        List<String> relativePaths = response.fileList.collect { String absolute ->
            relativise(absolute)
        }

        List<String> orderedKeys = orderedResultKeys(response.fileList)

        // A file-destination report (-report=<type>:<path>, as opposed to
        // -report=<type>:stdout) is produced by CodeNarc actually executing and writing to
        // disk - see AnalysisPartitioner.runCodeNarc. It is not part of the JSON result, so
        // it cannot be reconstructed from cached per-file violations. Bypass the cache
        // entirely in that case - neither read from it nor write to it - so CodeNarc always
        // actually runs and the file always gets (re)written, instead of a fully-cached
        // request silently skipping execution and never producing the file.
        boolean fileReport = AnalysisPartitioner.hasFileReport(baseArgs)

        Map<String, List<Map>> cached = [:]
        List<String> toAnalyse = relativePaths
        Map<String, String> keyByRelative = [:]
        String fingerprint = null

        if (ctx.cache != null && !fileReport) {
            fingerprint = ctx.cache.fingerprint(baseArgs)
            toAnalyse = []
            relativePaths.eachWithIndex { String relative, int i ->
                File file = new File(response.fileList[i])
                String key = ctx.cache.keyFor(fingerprint, relative, file)
                keyByRelative.put(relative, key)
                List<Map> hit = ctx.cache.get(key)
                if (hit != null) {
                    cached.put(packageFileKey(relative), hit)
                } else {
                    toAnalyse << relative
                }
            }
        }

        LOGGER.debug('Calling CodeNarc with base args: {}', baseArgs)
        AnalysisPartitioner.AnalysisOutcome outcome =
            AnalysisPartitioner.analyse(toAnalyse, baseArgs, parallelism, ctx.pool, handle)

        // Store freshly computed results before merging.
        String template = outcome.reports ? outcome.reports[0] : null
        if (ctx.cache != null && !fileReport) {
            storeResults(outcome.reports, keyByRelative, ctx.cache)
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
        File baseDir = new File(codeNarcBaseDir).getAbsoluteFile()
        return absoluteFiles.collect { String absolutePath ->
            String relativePath = baseDir.toURI().relativize(new File(absolutePath).toURI()).getPath()
            return packageFileKey(relativePath)
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
     */
    private void storeResults(List<String> reports, Map<String, String> keyByRelative, ResultCache cache) {
        com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper()
        reports.findAll { it }.each { String report ->
            Map parsed = mapper.readValue(report, Map)
            (parsed.packages ?: []).each { Map pkg ->
                String pkgPath = pkg.path ?: ''
                (pkg.files ?: []).each { Map file ->
                    String relative = pkgPath ? "${pkgPath}/${file.name}" : file.name.toString()
                    String key = keyByRelative.get(relative)
                    if (key != null) {
                        cache.put(key, (file.violations ?: []) as List<Map>)
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
