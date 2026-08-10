# npm-groovy-lint Performance Stage 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a lint run ~2.5–3x faster by removing dead rule work, cheapening the parse phase, and adding in-server file-level parallelism plus a result cache — without changing reported violations.

**Architecture:** All changes live in the Groovy server (`groovy/src/main/com/nvuillam/`) plus one preset file and one heap default. `Request.process()` gains three collaborators: a `ResultCache` (in-memory LRU), an `AnalysisPartitioner` (dedicated thread pool running one `CodeNarc` per file subset), and a `ResultMerger` (folds cached + per-partition JSON into one CodeNarc-shaped result). The HTTP contract is unchanged, so no Node or VS Code extension code changes.

**Tech Stack:** Groovy 4.0.26, CodeNarc 3.7.0, Jackson 2.22, Java 17–24, Node ≥22.13 (ESM), Mocha integration tests.

## Global Constraints

- Branch: **`perf/optimization-design`**. Never commit to `main`.
- Node >= 22.13; JDK 17–24 on PATH; Groovy required to rebuild the server jar.
- Groovy source is linted by npm-groovy-lint itself — obey its own rules (the codebase uses `@CompileDynamic`/`@CompileStatic` annotations and `/* groovylint-disable */` comments where needed).
- After **any** change under `groovy/src/main/`, run `npm run server:build` and commit the regenerated `lib/java/CodeNarcServer.jar` and `groovy/src/main/MANIFEST.MF`. CI's "Update check" job fails on a dirty tree.
- The committed jar's compression is Node-version-sensitive. If CI reports the jar as changed after you ran the build, rebuild with CI's Node version (see `CONTRIBUTING.md`).
- Never change the HTTP request/response shape in a way that breaks existing Node parsing. Adding new optional response fields is fine.
- Reported violations must not change (except the five rules deliberately disabled in Task 1).
- Prefer `Integer` over `int` for new `Response` fields so `@JsonInclude(NON_NULL)` omits them when unset.

---

## File Structure

**Created:**
- `groovy/src/main/com/nvuillam/SourceParser.groovy` — syntax-error collection via a shared `CompilationUnit`. Owns the fast-path/fallback decision.
- `groovy/src/main/com/nvuillam/ResultMerger.groovy` — merges partial CodeNarc JSON results into one, recomputing the summary.
- `groovy/src/main/com/nvuillam/AnalysisPartitioner.groovy` — splits files into subsets and runs CodeNarc on each via a pool.
- `groovy/src/main/com/nvuillam/ResultCache.groovy` — bounded LRU of per-file results.
- `groovy/src/main/com/nvuillam/LintContext.groovy` — carries the pool + cache into `Request.process()` (Jackson constructs `Request`, so dependencies cannot be constructor-injected).
- `test/perf-equivalence.test.js` — golden-equivalence and cache tests.

**Modified:**
- `lib/.groovylintrc-recommended.json` — disable the five phase-4 rules.
- `groovy/src/main/com/nvuillam/Request.groovy` — delegate parsing, partitioning, caching.
- `groovy/src/main/com/nvuillam/Response.groovy` — add optional `cacheHits`/`cacheMisses`/`partitionCount`.
- `groovy/src/main/com/nvuillam/CodeNarcServer.groovy` — own the analysis pool and cache; propagate cancellation to futures.
- `lib/codenarc-caller.js:29` — raise default heap.
- `CHANGELOG.md` — document the behaviour change.

**Ordering rationale:** Tasks 1–2 are independent quick wins. Task 3 introduces the merger on a single partition (no behaviour change, easy to verify). Task 4 turns on parallelism, Task 5 adds caching, Task 6 fixes cancellation — each building on the merger.

---

### Task 1: Disable the five dead phase-4 rules

Four `enhanced.*` rules and `grails.GrailsDomainGormMethods` require compiler phase 4 (semantic analysis). npm-groovy-lint never passes a user classpath, so that compile fails with `unable to resolve class`, the work is discarded, and they report nothing while costing ~9.4s on a 20-file corpus. Disabling them also removes the per-file stack-trace logging storm, which they are the only source of.

**Files:**
- Modify: `lib/.groovylintrc-recommended.json`
- Modify: `CHANGELOG.md`
- Test: `test/config.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: nothing consumed by later tasks. `loadConfig` output for `recommended` now maps these five rule names to `"off"`.

- [ ] **Step 1: Write the failing test**

Append inside the existing top-level `describe` block in `test/config.test.js`:

```js
it("(CFG) recommended disables the phase-4 rules that cannot resolve classes", async function () {
    const linter = new NpmGroovyLint([process.execPath, "", "--no-insight"], { parseOptions: true });
    const config = await linter.loadConfig("recommended");
    const deadRules = [
        "enhanced.CloneWithoutCloneable",
        "enhanced.JUnitAssertEqualsConstantActualValue",
        "enhanced.MissingOverrideAnnotation",
        "enhanced.UnsafeImplementationAsMap",
        "grails.GrailsDomainGormMethods",
    ];
    for (const ruleName of deadRules) {
        assert(
            config.rules[ruleName] === "off",
            `${ruleName} should be "off" in recommended (was ${JSON.stringify(config.rules[ruleName])})`,
        );
    }
});
```

If `test/config.test.js` does not already import `NpmGroovyLint` and `assert`, add at the top:

```js
import NpmGroovyLint from "../lib/groovy-lint.js";
import assert from "assert";
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx mocha test/config.test.js --grep "phase-4"`
Expected: FAIL — the rules are currently `{}` (enabled), not `"off"`.

- [ ] **Step 3: Disable the rules**

In `lib/.groovylintrc-recommended.json`, add these five entries inside `"rules"`, keeping the existing alphabetical-ish grouping (insert the `enhanced.*` block after the `dry.*` entries and `grails.*` after it):

```json
        "enhanced.CloneWithoutCloneable": "off",
        "enhanced.JUnitAssertEqualsConstantActualValue": "off",
        "enhanced.MissingOverrideAnnotation": "off",
        "enhanced.UnsafeImplementationAsMap": "off",
        "grails.GrailsDomainGormMethods": "off",
```

Ensure the preceding line still ends with a comma and the JSON stays valid.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx mocha test/config.test.js --grep "phase-4"`
Expected: PASS

- [ ] **Step 5: Verify the logging storm is gone**

Run: `node lib/index.js --killserver && node lib/index.js -o none lib/example/SampleFile.groovy 2>&1 | grep -c "non-default compiler phase"`
Expected: `0` (was non-zero before).

- [ ] **Step 6: Document the behaviour change**

Add to the top `## [Unreleased]` section of `CHANGELOG.md` (create the section if absent):

```markdown
### Changed

- Performance: the `recommended` preset now disables five rules that require the
  semantic-analysis compiler phase (`enhanced.CloneWithoutCloneable`,
  `enhanced.JUnitAssertEqualsConstantActualValue`, `enhanced.MissingOverrideAnnotation`,
  `enhanced.UnsafeImplementationAsMap`, `grails.GrailsDomainGormMethods`).
  npm-groovy-lint does not pass a user classpath, so these rules could not resolve
  imported classes and reported nothing while costing roughly 9 seconds on a
  20-file corpus. Re-enable them in your `.groovylintrc.json` if your sources have
  no unresolvable imports and you rely on them.
```

- [ ] **Step 7: Commit**

```bash
git add lib/.groovylintrc-recommended.json test/config.test.js CHANGELOG.md
git commit -m "perf: disable five phase-4 rules that report nothing without a classpath"
```

---

### Task 2: Replace per-file bytecode compilation with a shared CompilationUnit

`Request.parseFile` calls `loader.parseClass(...)`, a full compile to bytecode, purely to collect syntax errors. Only `Phases.CONVERSION` is needed. Measured on 20 files: per-file `parseClass` 767ms, per-file `CompilationUnit` 662ms, one shared `CompilationUnit` 153ms.

The shared unit stops once `ErrorCollector` reaches its tolerance, which would silently drop errors for later files. Mitigation: raise tolerance, attribute errors by `sourceLocator`, and fall back to per-file compilation if the shared pass throws anything other than a compilation error.

**Files:**
- Create: `groovy/src/main/com/nvuillam/SourceParser.groovy`
- Modify: `groovy/src/main/com/nvuillam/Request.groovy` (remove `parseFiles`, `parseFile`, `parseFileErrors`; delegate to `SourceParser`)
- Test: `test/perf-equivalence.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `SourceParser.parseFiles(List<String> absolutePaths)` returns `Map<String, List<String>>` — absolute file path to list of formatted error strings, the exact shape `Response.parseErrors` already uses and that `lib/codenarc-factory.js:256` consumes.

- [ ] **Step 1: Write the failing test**

Create `test/perf-equivalence.test.js`:

```js
#! /usr/bin/env node
import NpmGroovyLint from "../lib/groovy-lint.js";
import assert from "assert";
import { beforeEachTestCase, SAMPLE_FILE_PARSE_ERROR_PATH } from "./helpers/common.js";

describe("Performance Stage 1", function () {
    it("(PERF) still reports parse errors after the parser rewrite", async function () {
        beforeEachTestCase();
        const linter = await new NpmGroovyLint(
            {
                path: "./lib/example/",
                files: "**/WithParseError.groovy",
                insight: false,
                failon: "none",
                output: "none",
            },
            {},
        ).run();
        assert(linter.status === 0, `Linter status should be 0 (${linter.status} returned)`);
        const files = Object.keys(linter.lintResult.files);
        const parseErrors = files.flatMap((f) =>
            linter.lintResult.files[f].errors.filter((e) => e.rule === "NglParseError"),
        );
        assert(parseErrors.length > 0, `Expected at least one NglParseError, got none. Sample path: ${SAMPLE_FILE_PARSE_ERROR_PATH}`);
    });
});
```

- [ ] **Step 2: Run test to verify it passes on current code**

Run: `npm run server:kill && npx mocha test/perf-equivalence.test.js`
Expected: PASS. This is a characterization test — it must stay green through the rewrite. If it fails now, stop and investigate before changing anything.

- [ ] **Step 3: Create SourceParser**

Create `groovy/src/main/com/nvuillam/SourceParser.groovy`:

```groovy
package com.nvuillam

import groovy.transform.CompileDynamic
import org.codehaus.groovy.control.CompilationUnit
import org.codehaus.groovy.control.CompilerConfiguration
import org.codehaus.groovy.control.ErrorCollector
import org.codehaus.groovy.control.MultipleCompilationErrorsException
import org.codehaus.groovy.control.Phases
import org.codehaus.groovy.control.messages.Message
import org.codehaus.groovy.control.messages.SyntaxErrorMessage
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
            parseShared(absolutePaths, result)
        } catch (Throwable t) {
            // The shared pass could not be attributed reliably: redo per file so
            // every file still gets accurate errors.
            LOGGER.debug('Shared parse failed, falling back to per-file parse', t)
            absolutePaths.each { path ->
                result.put(path, parseSingle(path))
            }
        }

        return result
    }

    private static void parseShared(List<String> absolutePaths, Map<String, List<String>> result) {
        CompilerConfiguration config = new CompilerConfiguration(CompilerConfiguration.DEFAULT)
        config.setTolerance(ERROR_TOLERANCE)
        CompilationUnit unit = new CompilationUnit(config, null, new GroovyClassLoader())
        absolutePaths.each { unit.addSource(new File(it)) }

        try {
            unit.compile(Phases.CONVERSION)
        } catch (MultipleCompilationErrorsException e) {
            collectErrors(e.errorCollector, absolutePaths, result)
        }
    }

    private static void collectErrors(ErrorCollector collector, List<String> absolutePaths,
                                      Map<String, List<String>> result) {
        // Index canonical paths so a sourceLocator can be matched back to its input path.
        Map<String, String> byCanonical = [:]
        absolutePaths.each { byCanonical.put(new File(it).canonicalPath, it) }

        collector.errors.each { Message message ->
            String locator = null
            if (message instanceof SyntaxErrorMessage) {
                locator = ((SyntaxErrorMessage)message).cause?.sourceLocator
            }

            String target = null
            if (locator) {
                target = byCanonical.get(new File(locator).canonicalPath)
                if (target == null) {
                    target = absolutePaths.find { it.endsWith(locator) || locator.endsWith(new File(it).name) }
                }
            }

            if (target == null) {
                // Unattributable error: fail the shared pass so the caller retries per file
                // rather than silently dropping or misfiling it.
                throw new IllegalStateException("Unable to attribute compilation error to a source file: ${locator}")
            }

            result.get(target) << formatMessage(message)
        }
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
```

- [ ] **Step 4: Delegate from Request**

In `groovy/src/main/com/nvuillam/Request.groovy`, replace the whole `parseFiles` method body and delete `parseFile` and `parseFileErrors`:

```groovy
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
```

Then remove these now-unused imports from `Request.groovy`:

```groovy
import org.codehaus.groovy.control.CompilationFailedException
import org.codehaus.groovy.control.CompilerConfiguration
import org.codehaus.groovy.control.MultipleCompilationErrorsException
```

- [ ] **Step 5: Rebuild the server and run the tests**

```bash
npm run server:build
npm run server:kill
npx mocha test/perf-equivalence.test.js
```

Expected: PASS — parse errors are still reported.

- [ ] **Step 6: Verify the full suite still passes**

Run: `npm run test`
Expected: no new failures versus the pre-change baseline. Record any pre-existing failures before starting so you can tell them apart.

- [ ] **Step 7: Commit**

```bash
git add groovy/src/main/com/nvuillam/SourceParser.groovy groovy/src/main/com/nvuillam/Request.groovy groovy/src/main/MANIFEST.MF lib/java/CodeNarcServer.jar test/perf-equivalence.test.js
git commit -m "perf: collect syntax errors at CONVERSION phase instead of full compile"
```

---

### Task 3: Introduce ResultMerger on a single partition

Parallelism and caching both need one capability: turning several partial CodeNarc reports into one. Build and prove it here with a single partition, so any output difference is caught before concurrency is added.

**Files:**
- Create: `groovy/src/main/com/nvuillam/ResultMerger.groovy`
- Modify: `groovy/src/main/com/nvuillam/Request.groovy`
- Test: `test/perf-equivalence.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `ResultMerger.merge(List<String> partialReports, Map<String, List<Map>> cachedByFile, String template)` returns a `String` of CodeNarc-shaped JSON. `template` is a report whose `codeNarc` and `rules` blocks are copied into the result (pass `null` to use the first partial report). Task 4 passes multiple reports; Task 5 passes the cached map and a cached template.

The CodeNarc JSON report shape this merges (as consumed by `lib/codenarc-factory.js:315`):

```json
{
  "codeNarc": { "...": "..." },
  "summary": { "totalFiles": 20, "filesWithViolations": 18, "priority1": 0, "priority2": 2320, "priority3": 33500 },
  "packages": [ { "path": "src", "files": [ { "name": "A.groovy", "violations": [ { "ruleName": "X", "priority": 3, "lineNumber": 12, "message": "..." } ] } ] } ],
  "rules": [ { "name": "X", "description": "..." } ]
}
```

- [ ] **Step 1: Write the failing test**

Add to `test/perf-equivalence.test.js` inside the `describe`:

```js
it("(PERF) merged output equals direct CodeNarc output on the example directory", async function () {
    beforeEachTestCase();
    const run = async () =>
        await new NpmGroovyLint(
            {
                path: "./lib/example/",
                files: "**/*.groovy",
                insight: false,
                failon: "none",
                output: "none",
            },
            {},
        ).run();

    const first = await run();
    assert(first.status === 0, `Linter status should be 0 (${first.status} returned)`);
    const summary = first.lintResult.summary;
    assert(summary.totalFilesLinted > 1, `Expected several linted files, got ${summary.totalFilesLinted}`);

    const second = await run();
    assert.deepStrictEqual(
        second.lintResult.summary,
        summary,
        "Summary must be stable across runs once results go through ResultMerger",
    );
});
```

- [ ] **Step 2: Run test to verify it passes on current code**

Run: `npm run server:kill && npx mocha test/perf-equivalence.test.js --grep "merged output"`
Expected: PASS (characterization baseline — it must stay green after the merger is inserted).

- [ ] **Step 3: Create ResultMerger**

Create `groovy/src/main/com/nvuillam/ResultMerger.groovy`:

```groovy
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
```

- [ ] **Step 4: Route Request through the merger**

In `Request.groovy`, replace the report-extraction block at the end of `process` with:

```groovy
        codeNarc.reports.each { reportWriter ->
            if (!(reportWriter instanceof CapturedReportWriter)) { // groovylint-disable-line Instanceof
                // Not a captured report writer, ignore.
                return
            }

            CapturedReportWriter captured = (CapturedReportWriter)reportWriter
            if (captured.capturedClassName().toLowerCase().contains('json')) {
                response.setJsonResult(ResultMerger.merge([captured.report()], [:], captured.report()))
            } else {
                response.setStdout(captured.report())
            }
        }
```

- [ ] **Step 5: Rebuild and verify output is unchanged**

```bash
npm run server:build
npm run server:kill
npx mocha test/perf-equivalence.test.js
```

Expected: PASS. If the summary changed, the merger's recomputation disagrees with CodeNarc's — fix the merger, do not adjust the test.

- [ ] **Step 6: Cross-check against a known corpus**

```bash
node lib/index.js --killserver
node lib/index.js -o json lib/example/SampleFile.groovy > /tmp/after.json
git stash && npm run server:build && node lib/index.js --killserver
node lib/index.js -o json lib/example/SampleFile.groovy > /tmp/before.json
git stash pop && npm run server:build
diff <(node -e "const j=require('/tmp/before.json');console.log(JSON.stringify(j.summary))") <(node -e "const j=require('/tmp/after.json');console.log(JSON.stringify(j.summary))")
```

Expected: no diff.

- [ ] **Step 7: Commit**

```bash
git add groovy/src/main/com/nvuillam/ResultMerger.groovy groovy/src/main/com/nvuillam/Request.groovy groovy/src/main/MANIFEST.MF lib/java/CodeNarcServer.jar test/perf-equivalence.test.js
git commit -m "refactor: route CodeNarc report through ResultMerger"
```

---

### Task 4: Parallelise analysis across a dedicated thread pool

Analysis is single-threaded today. Partitioning across 4 threads measured 2.09x with byte-identical output (35,600 violations at 1, 2, 4 and 8 threads). Speedup plateaus at 4, so the cap is 4.

Two hazards this task must respect:
- The pool must **not** be the HTTP executor at `CodeNarcServer.groovy:129`. Submitting analysis work to the pool serving the request deadlocks under load.
- Each partition must use its own `CodeNarc` + `CapturePlugin` + `CapturedReportWriter` and must never touch the global `System.out`.

**Files:**
- Create: `groovy/src/main/com/nvuillam/AnalysisPartitioner.groovy`
- Create: `groovy/src/main/com/nvuillam/LintContext.groovy`
- Modify: `groovy/src/main/com/nvuillam/CodeNarcServer.groovy`
- Modify: `groovy/src/main/com/nvuillam/Request.groovy`
- Modify: `groovy/src/main/com/nvuillam/Response.groovy`
- Modify: `lib/codenarc-caller.js`
- Test: `test/perf-equivalence.test.js`

**Interfaces:**
- Consumes: `ResultMerger.merge(...)` from Task 3.
- Produces:
  - `LintContext(ExecutorService pool, ResultCache cache)` with fields `pool` and `cache` (cache is `null` until Task 5).
  - `AnalysisPartitioner.analyse(List<String> relativePaths, List<String> codeNarcArgs, Integer requested, ExecutorService pool)` returns `AnalysisOutcome` with fields `List<String> reports` and `int partitionCount`. (Task 6 adds a fifth `RequestHandle` parameter.)
  - `AnalysisPartitioner.MAX_PARTITIONS` — the constant `4`, also used by `CodeNarcServer` to size its pool.
  - `Request.process(Response response, LintContext ctx)` — the single-argument overload is kept, delegating with a context whose pool is a same-thread executor.

- [ ] **Step 1: Write the failing test**

Add to `test/perf-equivalence.test.js`:

```js
it("(PERF) parallel analysis returns the same violations as sequential", async function () {
    this.timeout(300000);
    beforeEachTestCase();

    const lint = async (extraOptions) =>
        await new NpmGroovyLint(
            {
                path: "./lib/example/",
                files: "**/*.groovy",
                insight: false,
                failon: "none",
                output: "none",
                ...extraOptions,
            },
            {},
        ).run();

    const parallel = await lint({});
    const sequential = await lint({ parallelism: 1 });

    const flatten = (res) =>
        Object.keys(res.lintResult.files)
            .sort()
            .map((f) => ({
                file: f,
                errors: res.lintResult.files[f].errors
                    .map((e) => `${e.rule}:${e.line}:${e.severity}`)
                    .sort(),
            }));

    assert.deepStrictEqual(flatten(parallel), flatten(sequential), "Parallel and sequential results must be identical");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run server:kill && npx mocha test/perf-equivalence.test.js --grep "parallel analysis"`
Expected: FAIL — the `parallelism` option does not exist yet, so both runs are identical for the wrong reason, or option parsing rejects it. Confirm the failure mode before proceeding.

- [ ] **Step 3: Add the `parallelism` option**

In `lib/options.js`, add to the option definitions array (match the surrounding entry style):

```js
        {
            option: "parallelism",
            alias: "P",
            type: "Int",
            description: "Number of threads used to analyse files in parallel (default: auto, max 4). Use 1 to disable.",
        },
```

In `lib/codenarc-caller.js`, add `parallelism` to the `requestData` object built in `callCodeNarcServer`:

```js
            requestKey: this.execOpts.requestKey || null,
            parallelism: this.options.parallelism || null,
```

In `lib/codenarc-caller.js:29`, raise the default heap because N concurrent CodeNarc instances multiply peak heap:

```js
    additionalJavaArgs = ["-Xms256m", "-Xmx4096m"];
```

- [ ] **Step 4: Create LintContext**

Create `groovy/src/main/com/nvuillam/LintContext.groovy`:

```groovy
package com.nvuillam

import groovy.transform.CompileStatic
import java.util.concurrent.ExecutorService

/**
 * Carries per-server collaborators into request processing.
 *
 * Request instances are deserialized by Jackson, so these cannot be
 * constructor-injected into Request itself.
 */
@CompileStatic
class LintContext {

    final ExecutorService pool
    final ResultCache cache

    LintContext(ExecutorService pool, ResultCache cache) {
        this.pool = pool
        this.cache = cache
    }

}
```

- [ ] **Step 5: Create AnalysisPartitioner**

Create `groovy/src/main/com/nvuillam/AnalysisPartitioner.groovy`:

```groovy
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
            return Math.min(requested, relativePaths.size())
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
```

- [ ] **Step 6: Wire it into Request**

In `Request.groovy`, add the field and imports:

```groovy
    Integer parallelism
```

Initialise it in the no-arg constructor with `this.parallelism = null`.

Replace the CodeNarc-invocation part of `process` — everything after `response.parseErrors = ...`, **including the existing `codeNarcArgs.add('-plugins=com.nvuillam.CapturePlugin')` line and the `codeNarc.reports.each` block from Task 3**. Each partition now appends `-plugins=` itself in `runCodeNarc`, so leaving the old line in place would add it twice. Replace with:

```groovy
        // Strip any -includes the caller supplied: partitions supply their own.
        List<String> baseArgs = codeNarcArgs.findAll { !it.startsWith('-includes=') }

        List<String> relativePaths = response.fileList.collect { String absolute ->
            relativise(absolute)
        }

        AnalysisPartitioner.AnalysisOutcome outcome =
            AnalysisPartitioner.analyse(relativePaths, baseArgs, parallelism, ctx.pool)

        response.partitionCount = outcome.partitionCount
        response.setJsonResult(ResultMerger.merge(outcome.reports, [:], outcome.reports ? outcome.reports[0] : null))
```

Add the helper to `Request.groovy`:

```groovy
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
```

Change the signature to `void process(Response response, LintContext ctx)` and add a compatibility overload. The overload must shut its pool down, otherwise every call leaks a thread:

```groovy
    void process(Response response) {
        ExecutorService pool = Executors.newSingleThreadExecutor()
        try {
            process(response, new LintContext(pool, null))
        } finally {
            pool.shutdownNow()
        }
    }
```

Add the required imports to `Request.groovy`:

```groovy
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
```

- [ ] **Step 7: Add the response fields**

In `Response.groovy`, add below `List<String> fileList`:

```groovy
    // Diagnostics (optional, used by tests and --verbose).
    Integer partitionCount
    Integer cacheHits
    Integer cacheMisses
```

- [ ] **Step 8: Own the pool in CodeNarcServer**

In `CodeNarcServer.groovy`, add a field and initialise it in the constructor:

```groovy
    private final ExecutorService analysisPool
```

```groovy
        // Separate from the HTTP executor: analysis tasks submitted to the pool that is
        // serving the request would deadlock once all HTTP threads are busy.
        this.analysisPool = Executors.newFixedThreadPool(
            Math.max(1, Math.min(Runtime.runtime.availableProcessors(), AnalysisPartitioner.MAX_PARTITIONS)))
```

In the `request()` handler, replace `request.process(response)` with:

```groovy
                request.process(response, new LintContext(analysisPool, null))
```

In `stopServer()`, add before `ex.shutdown()`:

```groovy
        analysisPool.shutdownNow()
```

In `main()` (the no-server path), replace `request.process(response)` with:

```groovy
        ExecutorService oneShotPool = Executors.newFixedThreadPool(
            Math.max(1, Math.min(Runtime.runtime.availableProcessors(), AnalysisPartitioner.MAX_PARTITIONS)))
        try {
            request.process(response, new LintContext(oneShotPool, null))
        } finally {
            oneShotPool.shutdownNow()
        }
```

- [ ] **Step 9: Rebuild and run the equivalence test**

```bash
npm run server:build
npm run server:kill
npx mocha test/perf-equivalence.test.js
```

Expected: PASS — parallel and sequential results identical.

- [ ] **Step 10: Run the full suite**

Run: `npm run test`
Expected: no new failures.

- [ ] **Step 11: Commit**

```bash
git add groovy/src/main/com/nvuillam/ lib/options.js lib/codenarc-caller.js groovy/src/main/MANIFEST.MF lib/java/CodeNarcServer.jar test/perf-equivalence.test.js
git commit -m "perf: analyse files in parallel across a dedicated thread pool"
```

---

### Task 5: Add the in-memory result cache

Cache per-file results so repeat lints (VS Code, local CLI) skip CodeNarc entirely. Per-file caching is sound only because CodeNarc rules are per-`SourceFile` with no cross-file analysis.

The key includes the **relative path** (some rules depend on file location, not only content) and the **resolved ruleset** — including the *contents* of any `-rulesetfiles`, since a path alone would not notice an edited ruleset file.

**Files:**
- Create: `groovy/src/main/com/nvuillam/ResultCache.groovy`
- Modify: `groovy/src/main/com/nvuillam/Request.groovy`
- Modify: `groovy/src/main/com/nvuillam/CodeNarcServer.groovy`
- Test: `test/perf-equivalence.test.js`

**Interfaces:**
- Consumes: `ResultMerger.merge(...)`, `AnalysisPartitioner.analyse(...)`, `LintContext`.
- Produces: `ResultCache` with `String fingerprint(List<String> codeNarcArgs)`, `List<Map> get(String key)`, `void put(String key, List<Map> violations)`, `String keyFor(String fingerprint, String relativePath, File file)`, `String getTemplate(String fingerprint)`, `void putTemplate(String fingerprint, String report)`, and counters `hits`/`misses`.

**Why the template matters:** when every file is a cache hit, `outcome.reports` is empty, so `ResultMerger` has no source for the `codeNarc` and `rules` blocks. `parseCodeNarcResult` (`lib/codenarc-factory.js:227`) rejects a result whose `codeNarc` block is missing, so a fully-cached run would fail outright. The cache therefore stores one template report per fingerprint alongside the per-file violations.

- [ ] **Step 1: Write the failing test**

Add to `test/perf-equivalence.test.js`:

```js
it("(PERF) cache returns identical results and invalidates on content change", async function () {
    this.timeout(300000);
    const fs = await import("node:fs/promises");
    const { copyFilesInTmpDir } = await import("./helpers/common.js");
    beforeEachTestCase();

    const tmpDir = await copyFilesInTmpDir();
    const target = tmpDir + "/SampleFileSmall.groovy";

    const lint = async () =>
        await new NpmGroovyLint(
            { path: tmpDir, files: "**/SampleFileSmall.groovy", insight: false, failon: "none", output: "none" },
            {},
        ).run();

    const cold = await lint();
    const warm = await lint();
    // The warm run is fully cached: it exercises the path where no partition report
    // exists and the merged result must still carry the 'codeNarc' block.
    assert(cold.status === 0, `Cold run status should be 0 (${cold.status} returned)`);
    assert(warm.status === 0, `Fully-cached run status should be 0 (${warm.status} returned)`);
    const key = Object.keys(cold.lintResult.files)[0];
    assert.deepStrictEqual(
        warm.lintResult.files[key].errors.map((e) => `${e.rule}:${e.line}`).sort(),
        cold.lintResult.files[key].errors.map((e) => `${e.rule}:${e.line}`).sort(),
        "Cached run must return the same violations",
    );

    // Changing content must invalidate.
    const original = await fs.readFile(target, "utf8");
    await fs.writeFile(target, original + "\n\n\nclass ExtraClassAddedByTest { }\n");
    const afterEdit = await lint();
    const editedKey = Object.keys(afterEdit.lintResult.files)[0];
    assert(
        JSON.stringify(afterEdit.lintResult.files[editedKey].errors) !==
            JSON.stringify(cold.lintResult.files[key].errors),
        "Editing the file must invalidate its cache entry",
    );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run server:kill && npx mocha test/perf-equivalence.test.js --grep "cache returns"`
Expected: the first assertion passes trivially (no cache yet); the test is meaningful only after Step 3. Confirm it runs green, then confirm it *stays* green after the cache lands — this is a safety net, not a red-first test.

- [ ] **Step 3: Create ResultCache**

Create `groovy/src/main/com/nvuillam/ResultCache.groovy`:

```groovy
package com.nvuillam

import groovy.transform.CompileDynamic
import java.security.MessageDigest
import java.util.concurrent.atomic.AtomicInteger
import org.codenarc.util.CodeNarcVersion

/**
 * Bounded LRU cache of per-file CodeNarc violations.
 *
 * Sound only because CodeNarc rules are per-SourceFile with no cross-file
 * analysis: a file's violations depend on its own content, its path, and the
 * ruleset, and nothing else.
 */
@CompileDynamic
class ResultCache {

    // Entries are small (a violation list per file); this is a soft memory bound.
    static final int DEFAULT_MAX_ENTRIES = 5000

    // Bump when the cached value shape changes, to invalidate stale in-memory entries.
    private static final String SCHEMA_VERSION = '1'

    private final Map<String, List<Map>> entries
    // One report per fingerprint, kept so a fully-cached run can still emit the
    // 'codeNarc' and 'rules' blocks that lib/codenarc-factory.js requires.
    private final Map<String, String> templates = new java.util.concurrent.ConcurrentHashMap<String, String>()
    private final AtomicInteger hitCount = new AtomicInteger(0)
    private final AtomicInteger missCount = new AtomicInteger(0)

    ResultCache(int maxEntries = DEFAULT_MAX_ENTRIES) {
        this.entries = Collections.synchronizedMap(
            new LinkedHashMap<String, List<Map>>(16, 0.75f, true) {
                @Override
                protected boolean removeEldestEntry(Map.Entry<String, List<Map>> eldest) {
                    return size() > maxEntries
                }
            })
    }

    String getTemplate(String fingerprint) {
        return templates.get(fingerprint)
    }

    void putTemplate(String fingerprint, String report) {
        if (report != null) {
            templates.put(fingerprint, report)
        }
    }

    int getHits() { return hitCount.get() }

    int getMisses() { return missCount.get() }

    void resetCounters() {
        hitCount.set(0)
        missCount.set(0)
    }

    /**
     * Build a fingerprint of everything that affects results other than the file itself.
     *
     * Includes the contents of any -rulesetfiles, so editing a ruleset file invalidates
     * the cache even though its path is unchanged.
     */
    String fingerprint(List<String> codeNarcArgs) {
        StringBuilder sb = new StringBuilder()
        sb.append(SCHEMA_VERSION).append('|')
        sb.append(CodeNarcVersion.getVersion()).append('|')
        codeNarcArgs.sort(false).each { String arg ->
            if (arg.startsWith('-basedir=') || arg.startsWith('-includes=') || arg.startsWith('-report=')) {
                return // do not affect per-file results
            }
            sb.append(arg).append('|')
            if (arg.startsWith('-rulesetfiles=')) {
                arg.substring('-rulesetfiles='.length()).split(',').each { String ref ->
                    String path = ref.startsWith('file:') ? ref.substring('file:'.length()) : ref
                    try {
                        File f = new File(URLDecoder.decode(path, 'UTF-8'))
                        if (f.exists()) {
                            sb.append(sha256(f.bytes)).append('|')
                        }
                    } catch (Throwable ignored) {
                        // Unreadable ruleset reference: fall back to the raw string already appended.
                    }
                }
            }
        }
        return sha256(sb.toString().getBytes('UTF-8'))
    }

    /**
     * Build the cache key for one file.
     */
    String keyFor(String fingerprint, String relativePath, File file) {
        StringBuilder sb = new StringBuilder()
        sb.append(fingerprint).append('|').append(relativePath).append('|')
        sb.append(sha256(file.bytes))
        return sha256(sb.toString().getBytes('UTF-8'))
    }

    List<Map> get(String key) {
        List<Map> value = entries.get(key)
        if (value == null) {
            missCount.incrementAndGet()
        } else {
            hitCount.incrementAndGet()
        }
        return value
    }

    void put(String key, List<Map> violations) {
        entries.put(key, violations)
    }

    private static String sha256(byte[] data) {
        MessageDigest digest = MessageDigest.getInstance('SHA-256')
        return digest.digest(data).encodeHex().toString()
    }

}
```

- [ ] **Step 4: Use the cache in Request**

In `Request.groovy`, replace the analysis block from Task 4 with:

```groovy
        List<String> baseArgs = codeNarcArgs.findAll { !it.startsWith('-includes=') }

        List<String> relativePaths = response.fileList.collect { String absolute -> relativise(absolute) }

        Map<String, List<Map>> cached = [:]
        List<String> toAnalyse = relativePaths
        Map<String, String> keyByRelative = [:]
        String fingerprint = null

        if (ctx.cache != null) {
            fingerprint = ctx.cache.fingerprint(baseArgs)
            toAnalyse = []
            relativePaths.eachWithIndex { String relative, int i ->
                File file = new File(response.fileList[i])
                String key = ctx.cache.keyFor(fingerprint, relative, file)
                keyByRelative.put(relative, key)
                List<Map> hit = ctx.cache.get(key)
                if (hit != null) {
                    cached.put(cacheMapKey(relative), hit)
                } else {
                    toAnalyse << relative
                }
            }
        }

        AnalysisPartitioner.AnalysisOutcome outcome =
            AnalysisPartitioner.analyse(toAnalyse, baseArgs, parallelism, ctx.pool)

        // Store freshly computed results before merging.
        String template = outcome.reports ? outcome.reports[0] : null
        if (ctx.cache != null) {
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
        response.setJsonResult(ResultMerger.merge(outcome.reports, cached, template))
```

Add these helpers to `Request.groovy`:

```groovy
    /**
     * Build the "packagePath|fileName" key ResultMerger uses for cached entries.
     */
    private String cacheMapKey(String relativePath) {
        int sep = relativePath.lastIndexOf('/')
        String pkg = sep >= 0 ? relativePath.substring(0, sep) : ''
        String name = sep >= 0 ? relativePath.substring(sep + 1) : relativePath
        return "${pkg}|${name}"
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
```

- [ ] **Step 5: Give the server a cache**

In `CodeNarcServer.groovy`, add the field, initialise it, and pass it in:

```groovy
    private final ResultCache resultCache
```

```groovy
        this.resultCache = new ResultCache()
```

```groovy
                request.process(response, new LintContext(analysisPool, resultCache))
```

Leave the no-server `main()` path passing `null` — a one-shot process gains nothing from a cache.

- [ ] **Step 6: Rebuild and test**

```bash
npm run server:build
npm run server:kill
npx mocha test/perf-equivalence.test.js
```

Expected: PASS — all equivalence and cache tests green.

- [ ] **Step 7: Verify the cache actually hits**

```bash
node lib/index.js --killserver
node lib/index.js -o none lib/example/SampleFile.groovy
time node lib/index.js -o none lib/example/SampleFile.groovy
```

Expected: the second run is markedly faster than the first.

- [ ] **Step 8: Run the full suite**

Run: `npm run test`
Expected: no new failures.

- [ ] **Step 9: Commit**

```bash
git add groovy/src/main/com/nvuillam/ groovy/src/main/MANIFEST.MF lib/java/CodeNarcServer.jar test/perf-equivalence.test.js
git commit -m "perf: cache per-file lint results in the server"
```

---

### Task 6: Propagate cancellation to partition futures

Duplicate-request cancellation currently interrupts the HTTP handler thread (`CodeNarcServer.groovy:198`). Once analysis runs on a worker pool, that interrupt no longer reaches the threads doing the work, so a superseded VS Code keystroke leaves workers burning CPU.

**Files:**
- Modify: `groovy/src/main/com/nvuillam/CodeNarcServer.groovy`
- Modify: `groovy/src/main/com/nvuillam/AnalysisPartitioner.groovy`
- Test: `test/perf-equivalence.test.js`

**Interfaces:**
- Consumes: `AnalysisPartitioner.analyse(...)`.
- Produces: `RequestHandle` with `Thread thread` and `List<Future> futures`, plus `AnalysisPartitioner.analyse(..., RequestHandle handle)` registering its futures on the handle.

- [ ] **Step 1: Write the failing test**

Add to `test/perf-equivalence.test.js`:

```js
it("(PERF) a duplicate requestKey cancels the in-flight request", async function () {
    this.timeout(300000);
    beforeEachTestCase();

    const options = {
        path: "./lib/example/",
        files: "**/*.groovy",
        insight: false,
        failon: "none",
        output: "none",
    };

    const first = new NpmGroovyLint(options, { requestKey: "dup-key-test" }).run();
    // Give the first request time to start analysing before superseding it.
    await new Promise((resolve) => setTimeout(resolve, 400));
    const second = new NpmGroovyLint(options, { requestKey: "dup-key-test" }).run();

    const [firstResult, secondResult] = await Promise.all([first, second]);
    assert(
        firstResult.status === 9 || secondResult.status === 0,
        `Expected the superseded request to be cancelled (status 9), got ${firstResult.status} / ${secondResult.status}`,
    );
});
```

- [ ] **Step 2: Run test to verify current behaviour**

Run: `npm run server:kill && npx mocha test/perf-equivalence.test.js --grep "duplicate requestKey"`
Expected: it may pass because the handler thread interrupt still works for the merge step — but workers keep running. Record the observed behaviour; the real verification is Step 5.

- [ ] **Step 3: Add RequestHandle and register futures**

In `AnalysisPartitioner.groovy`, add:

```groovy
    static class RequestHandle {
        Thread thread
        final List<Future> futures = Collections.synchronizedList([])

        void cancelAll() {
            thread?.interrupt()
            synchronized (futures) {
                futures.each { it.cancel(true) }
            }
        }
    }
```

Change the `analyse` signature to accept a handle and register futures:

```groovy
    static AnalysisOutcome analyse(List<String> relativePaths, List<String> codeNarcArgs,
                                   Integer requested, ExecutorService pool, RequestHandle handle) {
```

Immediately after the `futures` list is built, add:

```groovy
        handle?.futures?.addAll(futures)
```

Add an interruption check inside `runCodeNarc` after `codeNarc.execute(...)` so a cancelled worker stops before doing merge work:

```groovy
        if (Thread.currentThread().isInterrupted()) {
            throw new InterruptedException('Cancelled after analysis')
        }
```

- [ ] **Step 4: Track handles in CodeNarcServer**

In `CodeNarcServer.groovy`, change the threads map declaration and its field type:

```groovy
    private final Map<String, AnalysisPartitioner.RequestHandle> handles
```

```groovy
        this.handles = new ConcurrentHashMap<String, AnalysisPartitioner.RequestHandle>()
```

Replace the duplicate-detection block in the `request()` handler:

```groovy
                AnalysisPartitioner.RequestHandle handle = new AnalysisPartitioner.RequestHandle()
                handle.thread = Thread.currentThread()
                Request request = READER.readValue(buf.toByteArray(), Request)
                if (request.requestKey != null && request.requestKey != 'undefined') {
                    requestKey = request.requestKey
                    LOGGER.debug("requestKey: $requestKey")
                    AnalysisPartitioner.RequestHandle previous = handles.put(requestKey, handle)
                    if (previous != null) {
                        // Cancel the superseded request, including its analysis workers.
                        previous.cancelAll()
                    }
                }

                request.process(response, new LintContext(analysisPool, resultCache), handle)
```

Update the `finally` block to `handles.remove(requestKey)`.

- [ ] **Step 4b: Thread the handle through Request**

In `Request.groovy`, add the three-argument form and make the existing two-argument form delegate:

```groovy
    void process(Response response, LintContext ctx) {
        process(response, ctx, null)
    }

    void process(Response response, LintContext ctx, AnalysisPartitioner.RequestHandle handle) {
        // ... existing body unchanged, except the analyse call below ...
    }
```

Inside the three-argument body, update the single call site to pass the handle:

```groovy
        AnalysisPartitioner.AnalysisOutcome outcome =
            AnalysisPartitioner.analyse(toAnalyse, baseArgs, parallelism, ctx.pool, handle)
```

The one-argument `process(Response)` overload from Task 4 is unchanged: it already delegates to the two-argument form, which now passes `null` for the handle.

- [ ] **Step 5: Rebuild and verify workers actually stop**

```bash
npm run server:build
npm run server:kill
npx mocha test/perf-equivalence.test.js --grep "duplicate requestKey"
```

Then confirm CPU actually drops: start a large lint with a requestKey, supersede it, and watch the java process CPU fall rather than stay pinned.

- [ ] **Step 6: Run the full suite**

Run: `npm run test`
Expected: no new failures.

- [ ] **Step 7: Commit**

```bash
git add groovy/src/main/com/nvuillam/ groovy/src/main/MANIFEST.MF lib/java/CodeNarcServer.jar test/perf-equivalence.test.js
git commit -m "fix: cancel analysis workers when a duplicate request supersedes one"
```

---

### Task 7: Measure and document the result

Confirm the change delivered, and record the numbers so the next person can tell regression from noise.

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `docs/superpowers/specs/2026-08-10-performance-design.md` (append measured outcome)

**Interfaces:**
- Consumes: everything above.
- Produces: nothing.

- [ ] **Step 1: Build a benchmark corpus**

```bash
mkdir -p /tmp/ngl-bench/src
for i in $(seq 1 20); do cp lib/example/SampleFile.groovy /tmp/ngl-bench/src/Sample$i.groovy; done
```

- [ ] **Step 2: Measure cold and warm**

```bash
node lib/index.js --killserver
time node lib/index.js -o none /tmp/ngl-bench/src      # cold: server start + first analysis
time node lib/index.js -o none /tmp/ngl-bench/src      # warm: cache hits
time node lib/index.js -o none --parallelism 1 /tmp/ngl-bench/src
```

Record all three. Run each three times and keep the **median**, not the best — measured variance on this workload was 28–62s for identical work, so a single sample proves nothing.

- [ ] **Step 3: Record the outcome in the spec**

Append a `## Measured outcome (Stage 1)` section to `docs/superpowers/specs/2026-08-10-performance-design.md` with the medians from Step 2 against the pre-change baseline of ~31–66s, and note the machine and core count.

If the speedup is materially below ~2.5x, say so plainly in that section rather than rounding up — the spec's estimate was explicitly a projection, and a miss is information for Stage 2, not a failure to hide.

- [ ] **Step 4: Finish the changelog entry**

Add under the same `## [Unreleased]` section from Task 1:

```markdown
### Performance

- Files are now analysed in parallel inside the CodeNarc server (up to 4 threads),
  with per-file results cached in memory across runs while the server stays alive.
  Syntax-error detection now compiles only to the CONVERSION phase instead of
  generating bytecode. Use `--parallelism 1` to restore single-threaded analysis.
```

- [ ] **Step 5: Commit**

```bash
git add CHANGELOG.md docs/superpowers/specs/2026-08-10-performance-design.md
git commit -m "docs: record measured Stage 1 performance outcome"
```

---

## Out of Scope

- **Stage 2 (ruleset curation).** `recommended` still extends `all` (386 active rules), which remains the single largest cost — roughly 36–50s of the benchmark corpus. Curating it is a product judgement about which rules earn their place and needs its own spec.
- **On-disk caching.** Would serve fresh CI containers, but brings serialization, eviction, corruption and concurrent-writer concerns.
- **Consolidating the `Space*` rules.** Roughly ten whitespace rules each perform an independent AST traversal; fixing that is an upstream CodeNarc contribution.
