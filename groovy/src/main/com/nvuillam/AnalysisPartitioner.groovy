package com.nvuillam

import groovy.transform.CompileDynamic
import java.util.concurrent.Callable
import java.util.concurrent.ExecutorService
import java.util.concurrent.Future
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
    }

    /**
     * Analyse the given files, in parallel when it is safe and worthwhile.
     *
     * @param relativePaths file paths relative to the CodeNarc basedir
     * @param codeNarcArgs the base CodeNarc arguments (without -includes)
     * @param requested the caller's requested parallelism, or null for auto
     * @param pool the executor to run partitions on
     * @return the captured JSON reports and the number of partitions used
     */
    static AnalysisOutcome analyse(List<String> relativePaths, List<String> codeNarcArgs,
                                   Integer requested, ExecutorService pool) {
        AnalysisOutcome outcome = new AnalysisOutcome()
        if (!relativePaths) {
            outcome.partitionCount = 0
            return outcome
        }

        int partitions = choosePartitionCount(relativePaths, requested)
        outcome.partitionCount = partitions

        if (partitions <= 1) {
            outcome.reports = [runCodeNarc(relativePaths, codeNarcArgs)]
            return outcome
        }

        List<List<String>> batches = split(relativePaths, partitions)
        List<Future<String>> futures = batches.collect { List<String> batch ->
            pool.submit({ runCodeNarc(batch, codeNarcArgs) } as Callable<String>)
        }

        try {
            outcome.reports = futures.collect { it.get() }
        } catch (Throwable t) {
            futures.each { it.cancel(true) }
            LOGGER.debug('Parallel analysis failed, retrying sequentially', t)
            // Retry once on a single thread. Catching Throwable (not Exception) is
            // deliberate: it covers OutOfMemoryError, where N concurrent CodeNarc
            // instances exhausted the heap and one sequential pass may still succeed.
            // A partition failure must never fail the whole request.
            outcome.reports = [runCodeNarc(relativePaths, codeNarcArgs)]
            outcome.partitionCount = 1
        }

        return outcome
    }

    /**
     * Decide how many partitions to use.
     *
     * Returns 1 when parallelism would be unsafe or pointless: an explicit request of 1,
     * a single file, or any path containing a comma (CodeNarc's -includes is comma
     * separated, so such a path cannot be expressed in a partition).
     */
    static int choosePartitionCount(List<String> relativePaths, Integer requested) {
        if (relativePaths.any { it.contains(',') }) {
            LOGGER.debug('Disabling parallelism: a file path contains a comma')
            return 1
        }
        if (requested != null && requested > 0) {
            return Math.min(Math.min(requested, MAX_PARTITIONS), relativePaths.size())
        }
        int cores = Runtime.runtime.availableProcessors()
        return Math.max(1, Math.min(Math.min(cores, MAX_PARTITIONS), relativePaths.size()))
    }

    private static List<List<String>> split(List<String> paths, int partitions) {
        List<List<String>> batches = (0..<partitions).collect { [] as List<String> }
        paths.eachWithIndex { String path, int i ->
            batches[i % partitions] << path
        }
        return batches.findAll { !it.isEmpty() }
    }

    private static String runCodeNarc(List<String> relativePaths, List<String> baseArgs) {
        if (Thread.currentThread().isInterrupted()) {
            throw new InterruptedException('Cancelled before analysis')
        }

        List<String> args = new ArrayList<String>(baseArgs)
        args.add("-includes=${relativePaths.join(',')}".toString())
        args.add('-plugins=com.nvuillam.CapturePlugin')

        CodeNarc codeNarc = new CodeNarc()
        codeNarc.execute(args as String[])

        String report = null
        codeNarc.reports.each { reportWriter ->
            if (!(reportWriter instanceof CapturedReportWriter)) { // groovylint-disable-line Instanceof
                return
            }
            CapturedReportWriter captured = (CapturedReportWriter)reportWriter
            if (captured.capturedClassName().toLowerCase().contains('json')) {
                report = captured.report()
            }
        }
        return report
    }

}
