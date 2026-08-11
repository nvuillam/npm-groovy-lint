package com.nvuillam

import groovy.transform.CompileDynamic
import org.codehaus.groovy.control.CompilationUnit
import org.codehaus.groovy.control.CompilerConfiguration
import org.codehaus.groovy.control.MultipleCompilationErrorsException
import org.codehaus.groovy.control.Phases
import org.codehaus.groovy.control.messages.Message
import org.slf4j.Logger
import org.slf4j.LoggerFactory

/**
 * Collects Groovy syntax errors without generating bytecode.
 *
 * Compiles only to Phases.CONVERSION: enough to surface syntax errors, and far
 * cheaper than GroovyClassLoader.parseClass which runs the whole pipeline.
 */
@CompileDynamic
class SourceParser {

    private static final Logger LOGGER = LoggerFactory.getLogger(SourceParser)

    // Raised well above the default of 10 so a single noisy file does not abort
    // the shared compile before later files have been processed.
    private static final int ERROR_TOLERANCE = 1000

    /**
     * Parse the given files and return their syntax errors.
     *
     * @param absolutePaths the absolute paths of files to parse
     * @return map of absolute file path to the list of formatted error strings
     */
    static Map<String, List<String>> parseFiles(List<String> absolutePaths) {
        Map<String, List<String>> result = [:]
        absolutePaths.each { result.put(it, []) }
        if (!absolutePaths) {
            return result
        }

        try {
            parseShared(absolutePaths)
        } catch (Throwable t) {
            // The shared pass found at least one error (or failed outright). Groovy's
            // CompilationUnit does not reliably continue converting every source once any
            // source in the batch fails to parse, so a subset of the batch's real errors can
            // go completely unreported rather than merely being mis-attributed. There is no
            // way to tell, from the partial result alone, which files were skipped - so treat
            // any failure of the shared pass as untrustworthy and redo the whole batch file by
            // file, which parses each file in isolation and cannot lose another file's errors.
            // Do not hand t itself to the logger: if it is a MultipleCompilationErrorsException,
            // rendering it (getMessage() -> ErrorCollector.write(), which iterates a plain
            // LinkedList) is not safe to do concurrently with another thread doing the same on
            // its own ErrorCollector, and can throw ConcurrentModificationException/NPE deep
            // inside logback - turning a routine parse-error fallback into a request failure.
            // The real error text is still captured safely by parseSingle() below, which runs
            // single-file and does not race.
            LOGGER.debug('Shared parse found errors ({}), falling back to per-file parse for full coverage', t.class.simpleName)
            absolutePaths.each { path ->
                result.put(path, parseSingle(path))
            }
        }

        return result
    }

    // Compiles every file together in one CompilationUnit for speed. Returns normally only
    // when the whole batch is free of syntax errors; any error must be handled by the caller
    // via the per-file fallback (see parseFiles for why the errors collected here cannot be
    // trusted as complete).
    private static void parseShared(List<String> absolutePaths) {
        CompilerConfiguration config = new CompilerConfiguration(CompilerConfiguration.DEFAULT)
        config.setTolerance(ERROR_TOLERANCE)
        CompilationUnit unit = new CompilationUnit(config, null, new GroovyClassLoader())
        absolutePaths.each { unit.addSource(new File(it)) }
        unit.compile(Phases.CONVERSION)
    }

    private static List<String> parseSingle(String path) {
        CompilerConfiguration config = new CompilerConfiguration(CompilerConfiguration.DEFAULT)
        config.setTolerance(ERROR_TOLERANCE)
        CompilationUnit unit = new CompilationUnit(config, null, new GroovyClassLoader())
        unit.addSource(new File(path))
        try {
            unit.compile(Phases.CONVERSION)
        } catch (MultipleCompilationErrorsException e) {
            return e.errorCollector.errors.collect { formatMessage(it) }
        } catch (Throwable t) {
            LOGGER.debug('Parse "{}" unexpected exception', path, t)
        }
        return []
    }

    private static String formatMessage(Message message) {
        StringWriter out = new StringWriter()
        PrintWriter writer = new PrintWriter(out)
        message.write(writer)
        writer.flush()
        return out.toString()
    }

}
