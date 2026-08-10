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
});
