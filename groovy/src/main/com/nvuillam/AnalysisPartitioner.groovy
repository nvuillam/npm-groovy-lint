package com.nvuillam

import groovy.transform.CompileDynamic
import java.util.concurrent.CancellationException
import java.util.concurrent.Callable
import java.util.concurrent.ExecutionException
import java.util.concurrent.ExecutorService
import java.util.concurrent.Future
import java.util.concurrent.atomic.AtomicInteger
import org.codenarc.CodeNarc
import org.slf4j.Logger
import org.slf4j.LoggerFactory

/**
 * Runs CodeNarc over a list of files, splitting the work across a thread pool.
 *
 * Each partition builds its own CodeNarc instance and captures its report via
 * CapturePlugin, so no thread mutates the global System.out.
 */
@CompileDynamic
class AnalysisPartitioner {

    private static final Logger LOGGER = LoggerFactory.getLogger(AnalysisPartitioner)

    // Measured speedup plateaus at 4 threads; more threads add heap pressure for no gain.
    static final int MAX_PARTITIONS = 4

    static class AnalysisOutcome {

        List<String> reports = []
        int partitionCount = 0
        // Non-JSON captured report (e.g. -report=xml:stdout), populated only on the
        // single-partition path - see runCodeNarc() and CodeNarcRunResult below.
        String stdoutReport = null

    }

    /**
     * What a single CodeNarc invocation captured: the JSON report (from -report=json:stdout,
     * if requested) and any other captured report that also targeted stdout but in a
     * different format (e.g. -report=xml:stdout). A report targeting a real file is never
     * captured here at all - CodeNarc writes it straight to disk as a side effect of
     * execute() - see CapturePlugin, which only wraps writers whose destination is stdout.
     */
    private static class CodeNarcRunResult {

        String jsonReport
        String stdoutReport

    }

    /**
     * Handle a caller can use to cancel an in-flight request: interrupting both the HTTP
     * handler thread that is blocked waiting on partition results, and every partition
     * future itself, so a superseded request's workers stop instead of burning CPU to
     * completion.
     */
    static class RequestHandle {

        Thread thread
        private final List<Future> futures = Collections.synchronizedList([])
        private final AtomicInteger cancelledCount = new AtomicInteger(0)
        // Guarded by synchronized(futures): true once cancelAll() has run, so futures
        // registered afterwards (a request cancelled while still listing/parsing files,
        // before AnalysisPartitioner even submitted its partitions) are caught too.
        private boolean cancelled = false

        /**
         * Register this request's partition futures so cancelAll() can cancel them.
         *
         * If the handle was already cancelled before these futures existed - the request
         * was superseded while still on synchronous pre-analysis work, before any partition
         * was submitted - cancel them immediately instead of leaving them to run: without
         * this, a cancelAll() that arrives too early finds an empty future list and cancels
         * nothing, and the partitions that show up moments later run to completion unnoticed.
         */
        void register(List<Future> newFutures) {
            synchronized (futures) {
                futures.addAll(newFutures)
                if (cancelled) {
                    cancelledCount.addAndGet(newFutures.count { Future f -> f.cancel(true) })
                }
            }
        }

        /**
         * Interrupt the handler thread and cancel every partition future registered so far.
         * Also flags the handle as cancelled so any future registered afterwards - see
         * register() - is cancelled on arrival rather than slipping through the race.
         *
         * @return the number of futures that were actually cancelled (i.e. had not already
         *         finished or already been cancelled), for diagnostics.
         */
        int cancelAll() {
            thread?.interrupt()
            int justCancelled = 0
            synchronized (futures) {
                cancelled = true
                futures.each { Future f ->
                    if (f.cancel(true)) {
                        justCancelled++
                    }
                }
            }
            cancelledCount.addAndGet(justCancelled)
            return justCancelled
        }

        int getCancelledCount() {
            return cancelledCount.get()
        }

    }

    /**
     * Analyse the given files, in parallel when it is safe and worthwhile.
     *
     * @param relativePaths file paths relative to the CodeNarc basedir
     * @param codeNarcArgs the base CodeNarc arguments (without -includes)
     * @param requested the caller's requested parallelism, or null for auto
     * @param pool the executor to run partitions on
     * @param handle registers the partitions' futures so a duplicate request can cancel
     *        them; may be null (e.g. one-shot CLI calls that have no duplicate detection)
     * @return the captured JSON reports and the number of partitions used
     */
    static AnalysisOutcome analyse(List<String> relativePaths, List<String> codeNarcArgs,
                                   Integer requested, ExecutorService pool, RequestHandle handle) {
        AnalysisOutcome outcome = new AnalysisOutcome()
        if (!relativePaths) {
            outcome.partitionCount = 0
            return outcome
        }

        int partitions = choosePartitionCount(relativePaths, requested, codeNarcArgs)
        outcome.partitionCount = partitions

        if (partitions <= 1) {
            CodeNarcRunResult result = runCodeNarc(relativePaths, codeNarcArgs)
            outcome.reports = [result.jsonReport]
            outcome.stdoutReport = result.stdoutReport
            return outcome
        }

        List<List<String>> batches = split(relativePaths, partitions)
        List<Future<CodeNarcRunResult>> futures = batches.collect { List<String> batch ->
            pool.submit({ runCodeNarc(batch, codeNarcArgs) } as Callable<CodeNarcRunResult>)
        }
        handle?.register(futures)

        try {
            // A file-destination report forces a single partition (see choosePartitionCount),
            // so with more than one partition here there is nothing but the JSON report to
            // aggregate: any non-JSON stdoutReport a partition captured is discarded.
            outcome.reports = futures.collect { it.get().jsonReport }
        } catch (InterruptedException | CancellationException cancelled) {
            // The handler thread was interrupted, or one of our own futures was cancelled:
            // this is a genuine cancellation, not a partition failure. Do not fall back to
            // a sequential retry - that would defeat the cancellation by moving the wasted
            // work onto this thread instead of stopping it, and would risk caching results
            // computed after the request was superseded.
            futures.each { it.cancel(true) }
            throw new InterruptedException('Cancelled during parallel analysis')
        } catch (ExecutionException ee) {
            if (ee.cause instanceof InterruptedException || ee.cause instanceof CancellationException) {
                futures.each { it.cancel(true) }
                throw new InterruptedException('Cancelled during parallel analysis')
            }
            futures.each { it.cancel(true) }
            // Do not hand ee itself to the logger: rendering its cause chain (logback builds a
            // ThrowableProxy for every cause) can call getMessage() on a wrapped
            // MultipleCompilationErrorsException, which is not safe to do concurrently with
            // another thread doing the same - see SourceParser.parseFiles for the full story.
            LOGGER.debug('Parallel analysis failed ({}), retrying sequentially', ee.cause?.class?.simpleName ?: ee.class.simpleName)
            // Retry once on a single thread. A partition failure must never fail the whole
            // request.
            CodeNarcRunResult retry = runCodeNarc(relativePaths, codeNarcArgs)
            outcome.reports = [retry.jsonReport]
            outcome.stdoutReport = retry.stdoutReport
            outcome.partitionCount = 1
        } catch (Throwable t) {
            futures.each { it.cancel(true) }
            // Same reasoning as the ExecutionException branch above: do not hand t itself to
            // the logger.
            LOGGER.debug('Parallel analysis failed ({}), retrying sequentially', t.class.simpleName)
            // Retry once on a single thread. Catching Throwable (not Exception) is
            // deliberate: it covers OutOfMemoryError, where N concurrent CodeNarc
            // instances exhausted the heap and one sequential pass may still succeed.
            // A partition failure must never fail the whole request.
            CodeNarcRunResult retry = runCodeNarc(relativePaths, codeNarcArgs)
            outcome.reports = [retry.jsonReport]
            outcome.stdoutReport = retry.stdoutReport
            outcome.partitionCount = 1
        }

        return outcome
                                   }

    /**
     * Decide how many partitions to use.
     *
     * Returns 1 when parallelism would be unsafe or pointless: an explicit request of 1,
     * a single file, any path containing a comma (CodeNarc's -includes is comma separated,
     * so such a path cannot be expressed in a partition), or a file-destination report
     * (-report=<type>:<path>). The latter is a hard requirement, not just an optimisation:
     * with N > 1 partitions every partition would run its own CodeNarc writing to the SAME
     * output path, so the file would end up containing only whichever partition finished
     * last, silently losing every other partition's results.
     */
    static int choosePartitionCount(List<String> relativePaths, Integer requested, List<String> codeNarcArgs = []) {
        if (relativePaths.any { it.contains(',') }) {
            LOGGER.debug('Disabling parallelism: a file path contains a comma')
            return 1
        }
        if (hasFileReport(codeNarcArgs)) {
            LOGGER.debug('Disabling parallelism: a file-destination report was requested')
            return 1
        }
        if (requested != null && requested > 0) {
            return Math.min(Math.min(requested, MAX_PARTITIONS), relativePaths.size())
        }
        int cores = Runtime.runtime.availableProcessors()
        return Math.max(1, Math.min(Math.min(cores, MAX_PARTITIONS), relativePaths.size()))
    }

    /**
     * True when codeNarcArgs contains a -report=&lt;type&gt;:&lt;destination&gt; whose
     * destination is a real file rather than stdout. Such a report is a side effect of
     * CodeNarc actually executing (CodeNarc writes it straight to disk) - it is not part of
     * the JSON result, so it can neither be served from ResultCache nor safely split across
     * partitions (see choosePartitionCount above and Request.process, which uses this same
     * check to bypass the cache).
     *
     * The destination is everything after the FIRST colon in the -report= value, not a
     * simple split(':'), because the destination itself is a path and so may legitimately
     * contain further colons (e.g. a Windows drive letter: -report=html:C:\path\report.html).
     */
    static boolean hasFileReport(List<String> codeNarcArgs) {
        return codeNarcArgs.any { String arg ->
            if (!arg.startsWith('-report=')) {
                return false
            }
            String value = arg.substring('-report='.length())
            int sep = value.indexOf(':')
            String destination = sep >= 0 ? value.substring(sep + 1) : null
            return destination && !destination.equalsIgnoreCase('stdout')
        }
    }

    private static List<List<String>> split(List<String> paths, int partitions) {
        List<List<String>> batches = (0..<partitions).collect { [] as List<String> }
        paths.eachWithIndex { String path, int i ->
            batches[i % partitions] << path
        }
        return batches.findAll { !it.isEmpty() }
    }

    private static CodeNarcRunResult runCodeNarc(List<String> relativePaths, List<String> baseArgs) {
        if (Thread.currentThread().isInterrupted()) {
            throw new InterruptedException('Cancelled before analysis')
        }

        List<String> args = new ArrayList<String>(baseArgs)
        args.add("-includes=${relativePaths.join(',')}".toString())
        args.add('-plugins=com.nvuillam.CapturePlugin')

        CodeNarc codeNarc = new CodeNarc()
        codeNarc.execute(args as String[])

        if (Thread.currentThread().isInterrupted()) {
            throw new InterruptedException('Cancelled after analysis')
        }

        CodeNarcRunResult result = new CodeNarcRunResult()
        codeNarc.reports.each { reportWriter ->
            if (!(reportWriter instanceof CapturedReportWriter)) { // groovylint-disable-line Instanceof
                // Not a captured report writer: either it targets a real file, written
                // directly to disk by execute() above as a side effect, or it is some other
                // writer type CapturePlugin does not wrap. Either way, there is nothing to
                // capture here.
                return
            }
            CapturedReportWriter captured = (CapturedReportWriter)reportWriter
            if (captured.capturedClassName().toLowerCase().contains('json')) {
                result.jsonReport = captured.report()
            } else {
                // A captured report writer that isn't JSON (e.g. -report=xml:stdout) still
                // targeted stdout, so surface its content the same way the original
                // single-threaded implementation did: as Response.stdout, not as part of the
                // JSON result ResultMerger aggregates.
                result.stdoutReport = captured.report()
            }
        }
        return result
    }

}
