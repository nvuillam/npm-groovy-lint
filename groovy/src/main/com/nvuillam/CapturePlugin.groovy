package com.nvuillam

import groovy.transform.CompileStatic
import org.codenarc.plugin.AbstractCodeNarcPlugin
import org.codenarc.report.AbstractReportWriter
import org.codenarc.report.ReportWriter

/**
 * Wraps reportWriters to capture stdout if needed.
 */
@CompileStatic
class CapturePlugin extends AbstractCodeNarcPlugin {

    /**
     * Process the list of ReportWriters wrapping any found AbstractReportWriter
     * writers that are configured to write to stdout, with a CapturedReportWriter
     * so we can safely run concurrent lints.
     *
     * @param reportWriters - the initial List of ReportWrites to be used
     */
    @Override
    void processReports(List<ReportWriter> reportWriters) {
        reportWriters.eachWithIndex { reportWriter, idx ->
            if (reportWriter instanceof AbstractReportWriter) { // groovylint-disable-line Instanceof
                AbstractReportWriter abstractReportWriter = (AbstractReportWriter)reportWriter
                if (abstractReportWriter.isWriteToStandardOut()) {
                    reportWriters[idx] = new CapturedReportWriter(abstractReportWriter)
                }
            }
        }
    }

}
