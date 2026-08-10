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

        assert(
            parallel.partitionCount > 1,
            `Expected the parallel run to use more than one partition, got ${parallel.partitionCount}. ` +
                "Otherwise this test compares two identical sequential runs and proves nothing.",
        );
        assert.strictEqual(sequential.partitionCount, 1, `Expected the sequential run to use exactly one partition, got ${sequential.partitionCount}`);

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
});
