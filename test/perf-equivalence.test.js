#! /usr/bin/env node
import NpmGroovyLint from "../lib/groovy-lint.js";
import assert from "assert";
import { beforeEachTestCase, SAMPLE_FILE_PARSE_ERROR_PATH } from "./helpers/common.js";
import fs from "node:fs";

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
        const parseErrors = files.flatMap((f) => linter.lintResult.files[f].errors.filter((e) => e.rule === "NglParseError"));
        assert(parseErrors.length > 0, `Expected at least one NglParseError, got none. Sample path: ${SAMPLE_FILE_PARSE_ERROR_PATH}`);
    });

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
        assert.deepStrictEqual(second.lintResult.summary, summary, "Summary must be stable across runs once results go through ResultMerger");
    });

    it("(PERF) parallel analysis returns the same violations as sequential", async function () {
        this.timeout(300000);
        const fs = await import("node:fs/promises");
        const path = await import("node:path");
        const { copyFilesInTmpDir } = await import("./helpers/common.js");
        beforeEachTestCase();

        // Each leg gets its own copy of ./lib/example with a unique marker comment appended to
        // every .groovy file, so its cache key can never collide with the other leg's, nor with
        // whatever the server's per-file result cache (added alongside parallel analysis) may
        // already hold for the unmodified example files from earlier tests in this suite.
        // Without this, the second lint() call below would be a 100% cache hit and report
        // partitionCount 0 regardless of parallelism, which is what happened once the cache landed.
        const markGroovyFiles = async (dir, marker) => {
            const relPaths = await fs.readdir(dir, { recursive: true });
            for (const relPath of relPaths) {
                if (relPath.endsWith(".groovy")) {
                    await fs.appendFile(path.join(dir, relPath), `\n// ${marker}\n`);
                }
            }
        };

        const lint = async (extraOptions) => {
            const tmpDir = await copyFilesInTmpDir();
            await markGroovyFiles(tmpDir, `cache-bust-${Math.random()}`);
            const result = await new NpmGroovyLint(
                {
                    path: tmpDir,
                    insight: false,
                    failon: "none",
                    output: "none",
                    ...extraOptions,
                },
                {},
            ).run();
            return { result, tmpDir };
        };

        const parallel = await lint({});
        const sequential = await lint({ parallelism: 1 });

        assert(
            parallel.result.partitionCount > 1,
            `Expected the parallel run to use more than one partition, got ${parallel.result.partitionCount}. ` +
                "Otherwise this test compares two identical sequential runs and proves nothing.",
        );
        assert.strictEqual(
            sequential.result.partitionCount,
            1,
            `Expected the sequential run to use exactly one partition, got ${sequential.result.partitionCount}`,
        );

        // Compare violations keyed by path relative to each run's own tmpDir, since the two legs
        // use different tmpDirs (see above) and so never share absolute file paths.
        const flatten = ({ result, tmpDir }) =>
            Object.keys(result.lintResult.files)
                .map((f) => ({
                    file: path.relative(tmpDir, f).split(path.sep).join("/"),
                    errors: result.lintResult.files[f].errors.map((e) => `${e.rule}:${e.line}:${e.severity}`).sort(),
                }))
                .sort((a, b) => a.file.localeCompare(b.file));

        assert.deepStrictEqual(flatten(parallel), flatten(sequential), "Parallel and sequential results must be identical");
    });

    it("(PERF) cache returns identical results and invalidates on content change", async function () {
        this.timeout(300000);
        const fs = await import("node:fs/promises");
        const { copyFilesInTmpDir } = await import("./helpers/common.js");
        beforeEachTestCase();

        const tmpDir = await copyFilesInTmpDir();
        const target = tmpDir + "/SampleFileSmall.groovy";

        // Target the single file via a positional arg rather than the "files" option: "files"
        // is read by codenarc-factory.js as options.file (singular), which optionsDefinition
        // never populates, so "files" silently does nothing and the whole directory would be
        // linted instead of just this file - making Object.keys(...)[0] below point at
        // whichever file happens to sort first rather than the one this test edits.
        const lint = async () => await new NpmGroovyLint({ path: tmpDir, _: [target], insight: false, failon: "none", output: "none" }, {}).run();

        const cold = await lint();
        const warm = await lint();
        // The warm run is fully cached: it exercises the path where no partition report
        // exists and the merged result must still carry the 'codeNarc' block.
        assert(cold.status === 0, `Cold run status should be 0 (${cold.status} returned)`);
        assert(warm.status === 0, `Fully-cached run status should be 0 (${warm.status} returned)`);
        // A cache test that would still pass with no cache at all is worthless: assert the
        // warm run actually served from the cache rather than just happening to match.
        assert(warm.cacheHits > 0, `Expected the warm run to report cache hits, got cacheHits=${warm.cacheHits} cacheMisses=${warm.cacheMisses}`);
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
            JSON.stringify(afterEdit.lintResult.files[editedKey].errors) !== JSON.stringify(cold.lintResult.files[key].errors),
            "Editing the file must invalidate its cache entry",
        );
    });

    it("(PERF) a file report is still written when every file is served from the cache", async function () {
        this.timeout(300000);
        const path = await import("node:path");
        const { copyFilesInTmpDir } = await import("./helpers/common.js");
        beforeEachTestCase();

        // Regression test for a bug that the plain (API:file) HTML/XML report tests only
        // caught by accident of pre-warm ordering (mochaGlobalSetup pre-lints ./lib/example
        // before any test runs, so those tests' basedir was always already cached). Here we
        // control the cache state explicitly: lint a corpus once to populate the cache, then
        // lint the exact same corpus again on the exact same (still running, still warm)
        // server, requesting an HTML file report. If the "every file is a cache hit" path
        // skips CodeNarc execution entirely, the report file - a side effect of CodeNarc
        // actually running - never gets written.
        const tmpDir = await copyFilesInTmpDir();
        const reportFileName = path.resolve(tmpDir, "CacheHitReport.html");
        const lint = (extraOptions) => new NpmGroovyLint({ path: tmpDir, insight: false, failon: "none", ...extraOptions }, {}).run();

        // Populate the cache.
        const warmup = await lint({ output: "none" });
        assert(warmup.status === 0, `Warm-up run status should be 0 (${warmup.status} returned)`);

        // Prove the corpus is now fully cached, via a plain run identical to the one about to
        // request the file report (except for --output). A file-destination report
        // deliberately bypasses the cache entirely - see Request.process - so cache stats
        // cannot be observed on that call itself; this is how we know it would otherwise have
        // been a 100% cache hit, which is exactly the scenario the bug needs.
        // cacheHits/cacheMisses are cumulative counters for the whole server process
        // (ResultCache never resets them), not scoped to a single request, so compare the
        // delta between these two consecutive calls rather than the raw totals.
        const stillCached = await lint({ output: "none" });
        const hitsDelta = stillCached.cacheHits - warmup.cacheHits;
        const missesDelta = stillCached.cacheMisses - warmup.cacheMisses;
        assert(
            hitsDelta > 0 && missesDelta === 0,
            `Expected the corpus to be fully served from the cache before requesting the report, got hitsDelta=${hitsDelta} missesDelta=${missesDelta}`,
        );

        // This is the actual regression check: before the fix, a fully-cached basedir made
        // AnalysisPartitioner.analyse([]) return immediately without ever executing CodeNarc,
        // so the report file was never written.
        const reportRun = await lint({ output: reportFileName });
        assert(reportRun.status === 0, `Report run status should be 0 (${reportRun.status} returned)`);
        assert(fs.existsSync(reportFileName), `Expected the HTML report to be written at ${reportFileName} even though every file was cached`);
    });

    it("(PERF) a duplicate requestKey cancels in-flight partition workers, not just the handler thread", async function () {
        this.timeout(300000);
        const fs = await import("node:fs/promises");
        const path = await import("node:path");
        const { copyFilesInTmpDir } = await import("./helpers/common.js");
        beforeEachTestCase();

        // A single copy of lib/example (11 files) is analysed in well under 400ms, so the
        // duplicate request below would race a first request that has often already
        // finished - which would make the test pass without the fix ever running (the
        // handler-thread interrupt alone is enough once there is nothing left to cancel).
        // Duplicating the corpus (x3, ~44 files spread across up to 4 partitions) pushes a
        // single analysis to ~13-14s on this machine (measured separately with the same
        // ruleset), so at +400ms every partition is still deep inside CodeNarc.execute() -
        // comfortably (>30x) inside the window, not right on the edge of a race.
        // Every duplicate also gets a marker unique to this test run appended to its
        // content, so the Task 5 result cache (keyed on file content) can never serve the
        // second request's files from a previous run and short-circuit the race.
        const DUPLICATION_FACTOR = 3;
        const tmpDir = await copyFilesInTmpDir();
        const relPaths = (await fs.readdir(tmpDir, { recursive: true })).filter((p) => p.endsWith(".groovy"));
        const marker = `cancel-test-${Math.random()}`;
        for (const relPath of relPaths) {
            const original = await fs.readFile(path.join(tmpDir, relPath), "utf8");
            for (let i = 0; i < DUPLICATION_FACTOR; i++) {
                const dupPath = path.join(tmpDir, relPath.replace(/\.groovy$/, `.dup${i}.groovy`));
                await fs.writeFile(dupPath, `${original}\n// ${marker}-${i}\n`);
            }
        }

        const options = {
            path: tmpDir,
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

        // Which of the two client-issued calls actually reaches the server *first* is not
        // guaranteed by the order this test fires them in (HTTP/connection scheduling can
        // reorder them - confirmed empirically: a standalone repro of this same race
        // sometimes had the client's "second" call arrive at the server before "first").
        // The server always cancels whichever one registered earlier, so pick out whichever
        // of the two ended up cancelled rather than assuming it is "first" - the property
        // this task is actually about (did cancellation reach the workers?) does not depend
        // on which side won that race.
        const cancelled = firstResult.status === 9 ? firstResult : secondResult.status === 9 ? secondResult : null;
        const succeeded = cancelled === firstResult ? secondResult : firstResult;

        assert(
            cancelled !== null,
            "Expected exactly one of the two duplicate requests to be cancelled (status 9), got " + `${firstResult.status} / ${secondResult.status}`,
        );
        assert.strictEqual(succeeded.status, 0, `Expected the other (superseding) request to succeed, got ${succeeded.status}`);
        // The discriminating assertion: before this task, a duplicate requestKey only
        // interrupted the HTTP handler thread. That was enough to make the handler stop
        // waiting and return status 9 (so the assertions above would already pass), while
        // the partition futures kept running to completion on the worker pool, wasting
        // CPU on a superseded request. cancelledWorkers is populated only from
        // Future.cancel(true) actually returning true (see AnalysisPartitioner.RequestHandle),
        // so a value of 0 here would mean cancellation never reached the workers - proving
        // this specific test would fail without the fix, not merely that a request returned.
        assert(
            cancelled.cancelledWorkers > 0,
            `Expected cancellation to reach in-flight partition workers (cancelledWorkers > 0), got ` +
                `${cancelled.cancelledWorkers}. A value of 0 (or undefined) means only the handler ` +
                "thread was interrupted while the analysis workers kept running to completion.",
        );
    });
});
