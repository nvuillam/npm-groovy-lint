package com.nvuillam

import groovy.ant.AntBuilder
import groovy.transform.CompileDynamic
import java.util.regex.Matcher
import java.util.regex.Pattern
import org.codehaus.groovy.ant.FileScanner
import org.codehaus.groovy.control.CompilationFailedException
import org.codehaus.groovy.control.CompilerConfiguration
import org.codehaus.groovy.control.MultipleCompilationErrorsException
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

    Request() {
        this.codeNarcArgs = []
        this.codeNarcBaseDir = '.'
        this.codeNarcIncludes = ['**/*.groovy']
        this.codeNarcExcludes = []
        this.parse = false
        this.fileList = []
        this.requestKey = null
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
     * Process the request.
     *
     * @param response the response to populate.
     */
    void process(Response response) {
        if (codeNarcArgs == VERSION_ARGS) {
            response.setStdout(codeNarcVersion())
            return
        }

        if (codeNarcArgs == HELP_ARGS) {
            response.setStdout(codeNarcHelp())
            return
        }

        // Detect parse errors if requested.
        response.fileList = listFiles()
        response.parseErrors = parseFiles(response.fileList)

        // Run CodeNarc capturing the output if needed.
        codeNarcArgs.add('-plugins=com.nvuillam.CapturePlugin')
        LOGGER.debug('Calling CodeNarc with args: {}', codeNarcArgs)
        CodeNarc codeNarc = new CodeNarc()
        codeNarc.execute(codeNarcArgs as String[])
        codeNarc.reports.each { reportWriter ->
            if (!(reportWriter instanceof CapturedReportWriter)) { // groovylint-disable-line Instanceof
                // Not a captured report writer, ignore.
                return
            }

            CapturedReportWriter captured = (CapturedReportWriter)reportWriter
            if (captured.capturedClassName().toLowerCase().contains('json')) {
                response.setJsonResult(captured.report())
            } else {
                response.setStdout(captured.report())
            }
        }
    }

    /**
     * Parse groovy files to detect errors if parsing is enabled.
     *
     * @param fileList the list of files to parse
     * @return the map of files to errors
     */
    private Map<String, List<String>> parseFiles(List<String> fileList) {
        Map<String, List<String>> parseErrors = [:]
        LOGGER.debug('parseFiles: parse={}, fileList={}', parse, fileList)
        if (parse) {
            fileList.each { file ->
                parseErrors.put(file, parseFile(new File(file)))
            }
        }

        return parseErrors
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

    // Try to parse file to get compilation errors as strings.
    private List<String> parseFile(File file) {
        List<String> errors = []
        for (err in parseFileErrors(file)) {
            StringWriter out = new StringWriter();
            PrintWriter writer = new PrintWriter(out);
            err.write(writer)
            errors << out.toString()
        }

        return errors
    }

    // Try to parse file to get compilation errors.
    private List<Error> parseFileErrors(File file) {
        try {
            // We don't use GroovyShell.parse as it calls InvokerHelper.createScript
            // which fails for files which contain a class which only have non-zero
            // argument constructors.
            GroovyShell shell = new GroovyShell()
            GroovyClassLoader loader = shell.getClassLoader()
            GroovyCodeSource codeSource = new GroovyCodeSource(file, CompilerConfiguration.DEFAULT.sourceEncoding)
            loader.parseClass(codeSource, false)
            LOGGER.debug('Parse "{}" success', file.getAbsolutePath())
        }
        catch (MultipleCompilationErrorsException ep) {
            LOGGER.debug('Parse "{}" multiple compilation errors', file.getAbsolutePath())
            return ep.getErrorCollector().getErrors()
        }
        catch (CompilationFailedException ep) {
            LOGGER.debug('Parse "{}" compilation failed', file.getAbsolutePath())
            return ep.getErrorCollector().getErrors()
        }
        catch (Throwable ep) {
            // Catch all exceptions to avoid failing the whole request as it's not critical
            // and we could get Errors such as java.lang.NoClassDefFoundError.
            LOGGER.error('Parse "{}" unexpected exception:', file.getAbsolutePath(), ep)
        }

        return []
    }

}
