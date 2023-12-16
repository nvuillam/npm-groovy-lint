package com.nvuillam

import groovy.transform.CompileStatic
import java.nio.charset.StandardCharsets
import org.codenarc.AnalysisContext
import org.codenarc.report.AbstractReportWriter
import org.codenarc.report.ReportWriter
import org.codenarc.results.Results

/**
 * Wraps AbstractReportWriter to capture the report which would
 * otherwise be written to stdout.
 */
@CompileStatic
class CapturedReportWriter implements ReportWriter {

    private final ByteArrayOutputStream buffer = new ByteArrayOutputStream()
    private final AbstractReportWriter inner

    CapturedReportWriter(AbstractReportWriter inner) {
        this.inner = inner
    }

    /**
     * Returns the generated report as a UTF-8 string.
     *
     * @return the generated report.
     */
    String report() {
        return buffer.toString(StandardCharsets.UTF_8.name())
    }

    /**
     * Returns the class name of the captured report writer.
     *
     * @return the name of the captured class.
     */
    String capturedClassName() {
        return this.inner.class.name
    }

    /**
     * Write out a report for the specified analysis results.
     *
     * @param analysisContext the AnalysisContext containing the analysis configuration information
     * @param results the analysis results
     */
    @Override
    void writeReport(AnalysisContext analysisContext, Results results) {
        assert analysisContext
        assert results

        // Capture the output instead of writing to stdout.
        OutputStreamWriter writer = new OutputStreamWriter(buffer)
        inner.writeReport(writer, analysisContext, results)
        writer.close()
    }

}
