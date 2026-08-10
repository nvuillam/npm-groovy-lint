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
        const lint = async () =>
            await new NpmGroovyLint({ path: tmpDir, _: [target], insight: false, failon: "none", output: "none" }, {}).run();

        const cold = await lint();
        const warm = await lint();
        // The warm run is fully cached: it exercises the path where no partition report
        // exists and the merged result must still carry the 'codeNarc' block.
        assert(cold.status === 0, `Cold run status should be 0 (${cold.status} returned)`);
        assert(warm.status === 0, `Fully-cached run status should be 0 (${warm.status} returned)`);
        // A cache test that would still pass with no cache at all is worthless: assert the
        // warm run actually served from the cache rather than just happening to match.
        assert(
            warm.cacheHits > 0,
            `Expected the warm run to report cache hits, got cacheHits=${warm.cacheHits} cacheMisses=${warm.cacheMisses}`,
        );
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
});
