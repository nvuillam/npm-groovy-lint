package com.nvuillam

import com.fasterxml.jackson.databind.ObjectMapper
import groovy.transform.CompileDynamic
import org.codenarc.util.CodeNarcVersion

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
     * @param orderedKeys "packagePath|fileName" keys in the order files should appear in the
     *        merged report (e.g. the request's own file list order); when null or empty, falls
     *        back to alphabetical order. A file present in the reports but absent from this list
     *        is still emitted, appended after the ordered ones, sorted alphabetically.
     * @return the merged report as a JSON string
     */
    static String merge(List<String> partialReports, Map<String, List<Map>> cachedByFile, String template,
                         List<String> orderedKeys = null) {
        List<Map> parsed = partialReports.findAll { it }.collect { MAPPER.readValue(it, Map) }

        Map merged = [:]
        Map source = template ? MAPPER.readValue(template, Map) : (parsed ? parsed[0] : [:])
        // The 'codeNarc' and 'rules' blocks are what makes the report usable by the Node side,
        // which rejects a result without them. There is nothing to copy them from when no
        // partition ran and no template was cached - which happens when the request matched no
        // file at all. Emit them anyway, so an empty match reports zero violations instead of
        // failing the run.
        merged.codeNarc = source.codeNarc != null ? source.codeNarc : [version: CodeNarcVersion.version]
        merged.rules = source.rules != null ? source.rules : []

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

        // Rebuild packages, ordered by orderedKeys (typically the request's own file list order)
        // so the merged report keeps the original file processing order. Falls back to
        // alphabetical order (by pkgPath, then fileName) when no ordering is given, or for any
        // file present in the data but absent from orderedKeys, so nothing is silently dropped.
        Map<String, Integer> rank = [:]
        if (orderedKeys) {
            orderedKeys.eachWithIndex { String key, int idx -> rank[key] = idx }
        }

        List<List<String>> allEntries = []
        byPackage.each { String pkgPath, Map<String, List> files ->
            files.keySet().each { String fileName ->
                allEntries << [pkgPath, fileName]
            }
        }

        List<List<String>> known = allEntries.findAll { List<String> entry -> rank.containsKey("${entry[0]}|${entry[1]}".toString()) }
        List<List<String>> unknown = allEntries.findAll { List<String> entry -> !rank.containsKey("${entry[0]}|${entry[1]}".toString()) }
        known = known.sort { List<String> entry -> rank["${entry[0]}|${entry[1]}".toString()] }
        unknown = unknown.sort()
        List<List<String>> sortedEntries = known + unknown

        Map<String, List> orderedPackages = new LinkedHashMap<>()
        sortedEntries.each { List<String> entry ->
            String pkgPath = entry[0]
            String fileName = entry[1]
            List fileEntries = orderedPackages.computeIfAbsent(pkgPath, { [] })
            fileEntries << [name: fileName, violations: byPackage[pkgPath][fileName]]
        }

        List packages = []
        orderedPackages.each { String pkgPath, List fileEntries ->
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
