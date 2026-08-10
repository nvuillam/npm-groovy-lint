package com.nvuillam

import com.fasterxml.jackson.databind.ObjectMapper
import groovy.transform.CompileDynamic

/**
 * Merges partial CodeNarc JSON reports (one per partition, plus cached
 * per-file results) into a single CodeNarc-shaped report.
 *
 * The summary is recomputed from the merged violations rather than summed from
 * the partial summaries, so counts stay correct however the work was split.
 */
@CompileDynamic
class ResultMerger {

    private static final ObjectMapper MAPPER = new ObjectMapper()

    /**
     * Merge partial reports and cached violations into one report.
     *
     * @param partialReports JSON strings produced by each partition, may be empty
     * @param cachedByFile map of "packagePath|fileName" to violation maps, may be empty
     * @param template a report to copy the 'codeNarc' and 'rules' blocks from; when null the
     *        first partial report is used
     * @return the merged report as a JSON string
     */
    static String merge(List<String> partialReports, Map<String, List<Map>> cachedByFile, String template) {
        List<Map> parsed = partialReports.findAll { it }.collect { MAPPER.readValue(it, Map) }

        Map merged = [:]
        Map source = template ? MAPPER.readValue(template, Map) : (parsed ? parsed[0] : [:])
        if (source.codeNarc != null) {
            merged.codeNarc = source.codeNarc
        }
        if (source.rules != null) {
            merged.rules = source.rules
        }

        // packagePath -> (fileName -> violations)
        Map<String, Map<String, List>> byPackage = [:]

        parsed.each { Map report ->
            (report.packages ?: []).each { Map pkg ->
                String pkgPath = pkg.path ?: ''
                Map<String, List> files = byPackage.computeIfAbsent(pkgPath, { [:] })
                (pkg.files ?: []).each { Map file ->
                    List violations = files.computeIfAbsent(file.name, { [] })
                    violations.addAll(file.violations ?: [])
                }
            }
        }

        cachedByFile.each { String key, List<Map> violations ->
            int sep = key.lastIndexOf('|')
            String pkgPath = sep >= 0 ? key.substring(0, sep) : ''
            String fileName = sep >= 0 ? key.substring(sep + 1) : key
            Map<String, List> files = byPackage.computeIfAbsent(pkgPath, { [:] })
            files.computeIfAbsent(fileName, { [] }).addAll(violations)
        }

        // Rebuild packages, sorted so output is deterministic regardless of completion order.
        List packages = []
        byPackage.keySet().sort().each { String pkgPath ->
            Map<String, List> files = byPackage.get(pkgPath)
            List fileEntries = []
            files.keySet().sort().each { String fileName ->
                fileEntries << [name: fileName, violations: files.get(fileName)]
            }
            Map pkg = [files: fileEntries]
            if (pkgPath) {
                pkg.path = pkgPath
            }
            packages << pkg
        }
        merged.packages = packages

        // Recompute the summary from the merged violations.
        int p1 = 0
        int p2 = 0
        int p3 = 0
        int totalFiles = 0
        int filesWithViolations = 0
        packages.each { Map pkg ->
            pkg.files.each { Map file ->
                totalFiles++
                List violations = file.violations ?: []
                if (violations) {
                    filesWithViolations++
                }
                violations.each { Map v ->
                    int priority = (v.priority ?: 0) as int
                    if (priority == 1) {
                        p1++
                    } else if (priority == 2) {
                        p2++
                    } else if (priority == 3) {
                        p3++
                    }
                }
            }
        }
        merged.summary = [
            totalFiles: totalFiles,
            filesWithViolations: filesWithViolations,
            priority1: p1,
            priority2: p2,
            priority3: p3,
        ]

        return MAPPER.writeValueAsString(merged)
    }

}
