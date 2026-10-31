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
 * Collects Groovy compilation errors.
 *
 * Compiles to Phases.CLASS_GENERATION, the phase GroovyClassLoader.parseClass (used before
 * v19) stopped at, so it reports the same errors: syntax errors (CONVERSION), semantic errors
 * such as a duplicate local variable or an unresolvable superclass (SEMANTIC_ANALYSIS),
 * @CompileStatic / @TypeChecked type errors (INSTRUCTION_SELECTION), and class checks such as a
 * missing abstract method implementation or a subclass of a final class (CLASS_GENERATION).
 * Stopping earlier would silently drop the later ones. It is still cheaper than parseClass:
 * the bytecode stays in memory and is never defined in a class loader, and files are compiled
 * together in shared batches. Note the Node side filters out "unable to resolve class"
 * messages, since no user classpath is passed here.
 */
@CompileDynamic
class SourceParser {

    private static final Logger LOGGER = LoggerFactory.getLogger(SourceParser)

    // Raised well above the default of 10. Only parseSingle relies on this: parseFiles
    // no longer trusts the shared pass once it reports any error and redoes the whole
    // batch file by file (see parseFiles below), so this tolerance's only effect is
    // letting a single file with many syntax errors report all of them in one pass
    // instead of stopping after the default 10.
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

        batchesWithUniqueNames(absolutePaths).each { List<String> batch ->
            parseBatch(batch, result)
        }
        return result
    }

    // Two files with the same base name (several Jenkinsfile, vars/*.groovy in different
    // folders...) compile to the same script class name, and one shared CompilationUnit would
    // fail on that "duplicate class definition" every time, forcing the slow per-file
    // fallback on every request. Put such files in separate batches instead.
    static List<List<String>> batchesWithUniqueNames(List<String> absolutePaths) {
        List<List<String>> batches = []
        List<Set<String>> namesByBatch = []
        absolutePaths.each { String path ->
            String name = baseName(path)
            int index = namesByBatch.findIndexOf { Set<String> names -> !names.contains(name) }
            if (index < 0) {
                batches << []
                namesByBatch << new HashSet<String>()
                index = batches.size() - 1
            }
            batches[index] << path
            namesByBatch[index] << name
        }
        return batches
    }

    private static String baseName(String path) {
        String name = new File(path).name
        int dot = name.lastIndexOf('.')
        return dot > 0 ? name.substring(0, dot) : name
    }

    private static void parseBatch(List<String> batch, Map<String, List<String>> result) {
        try {
            parseShared(batch)
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
            batch.each { path ->
                result.put(path, parseSingle(path))
            }
        }
    }

    // Compiles every file of a batch together in one CompilationUnit for speed. Returns normally only
    // when the whole batch is free of compilation errors; any error must be handled by the caller
    // via the per-file fallback (see parseFiles for why the errors collected here cannot be
    // trusted as complete).
    private static void parseShared(List<String> absolutePaths) {
        CompilerConfiguration config = new CompilerConfiguration(CompilerConfiguration.DEFAULT)
        config.setTolerance(ERROR_TOLERANCE)
        CompilationUnit unit = new CompilationUnit(config, null, new GroovyClassLoader())
        absolutePaths.each { unit.addSource(new File(it)) }
        unit.compile(Phases.CLASS_GENERATION)
    }

    private static List<String> parseSingle(String path) {
        CompilerConfiguration config = new CompilerConfiguration(CompilerConfiguration.DEFAULT)
        config.setTolerance(ERROR_TOLERANCE)
        CompilationUnit unit = new CompilationUnit(config, null, new GroovyClassLoader())
        unit.addSource(new File(path))
        try {
            unit.compile(Phases.CLASS_GENERATION)
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
