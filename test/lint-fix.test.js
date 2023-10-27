#! /usr/bin/env node
"use strict";
const NpmGroovyLint = require("../lib/groovy-lint.js");
let assert = require("assert");
const fse = require("fs-extra");
const rimraf = require("rimraf");
const {
    beforeEachTestCase,
    copyFilesInTmpDir,
    checkCodeNarcCallsCounter,
    SAMPLE_FILE_BIG_PATH,
    SAMPLE_FILE_SMALL_PATH
} = require("./helpers/common");

describe("Lint & fix with API", function() {
    beforeEach(beforeEachTestCase);

    it("(API:source) should lint then fix only a list of errors", async function() {
        const sampleFilePath = SAMPLE_FILE_BIG_PATH;
        const prevFileContent = fse.readFileSync(sampleFilePath).toString();
        const npmGroovyLintConfig = {
            source: prevFileContent,
            sourcefilepath: sampleFilePath,
            nolintafter: true,
            output: "none",
            insight: false,
            verbose: true
        };
        const linter = await new NpmGroovyLint(npmGroovyLintConfig, {}).run();

        let errIdList = linter.lintResult.files[0].errors.filter(error => error.fixable === true).map(err => err.id);
        errIdList = errIdList.slice(0, 500);
        await linter.fixErrors(errIdList);

        assert(linter.status === 1, `Linter status is 1 (${linter.status} returned)`);
        assert(linter.lintResult.summary.totalFixedNumber >= 100, "Errors have been fixed"); // can be more than the five sent errors, as there are other triggered fixes
        assert(linter.lintResult.files[0].updatedSource && linter.lintResult.files[0].updatedSource !== prevFileContent, "Source has been updated");
        assert(!linter.outputString.includes("NaN"), "Results does not contain NaN");
        checkCodeNarcCallsCounter(2);
    });

    it("(API:source) should lint and fix (one shot)", async function() {
        const sampleFilePath = SAMPLE_FILE_BIG_PATH;
        const expectedFixedErrs = 1076;
        const prevFileContent = fse.readFileSync(sampleFilePath).toString();
        const npmGroovyLintConfig = {
            source: prevFileContent,
            sourcefilepath: sampleFilePath,
            fix: true,
            output: "txt",
            insight: false,
            verbose: true
        };
        const linter = await new NpmGroovyLint(npmGroovyLintConfig, {}).run();

        assert(linter.status === 1, `Linter status is 1 (${linter.status} returned)`);
        assert(
            linter.lintResult.summary.totalFixedNumber >= expectedFixedErrs,
            `${expectedFixedErrs} errors have been fixed (${linter.lintResult.summary.totalFixedNumber} returned)`
        );
        assert(linter.lintResult.files[0].updatedSource && linter.lintResult.files[0].updatedSource !== prevFileContent, "Source has been updated");
        assert(!linter.outputString.includes("NaN"), "Results does not contain NaN");
        checkCodeNarcCallsCounter(3);
    }).timeout(200000);

    it("(API:source) should lint and fix (no lintagainafterfix)", async function() {
        const sampleFilePath = SAMPLE_FILE_BIG_PATH;
        const expectedFixedErrs = 1076;
        const prevFileContent = fse.readFileSync(sampleFilePath).toString();
        const npmGroovyLintConfig = {
            source: prevFileContent,
            sourcefilepath: sampleFilePath,
            fix: true,
            nolintafter: true,
            output: "txt",
            insight: false,
            verbose: true
        };
        const linter = await new NpmGroovyLint(npmGroovyLintConfig, {}).run();

        assert(linter.status === 1, `Linter status is 1 (${linter.status} returned)`);
        assert(
            linter.lintResult.summary.totalFixedNumber >= expectedFixedErrs,
            `${expectedFixedErrs} errors have been fixed (${linter.lintResult.summary.totalFixedNumber} returned)`
        );
        assert(linter.lintResult.files[0].updatedSource && linter.lintResult.files[0].updatedSource !== prevFileContent, "Source has been updated");
        assert(!linter.outputString.includes("NaN"), "Results does not contain NaN");
        checkCodeNarcCallsCounter(2);
    }).timeout(200000);

    it("(API:source) should lint and fix (no lintagainafterfix) 2", async function() {
        const sampleFilePath = SAMPLE_FILE_SMALL_PATH;
        const expectedFixedErrs = 3;
        const prevFileContent = fse.readFileSync(sampleFilePath).toString();
        const npmGroovyLintConfig = {
            source: prevFileContent,
            sourcefilepath: sampleFilePath,
            fix: true,
            nolintafter: true,
            output: "txt",
            insight: false,
            verbose: true
        };
        const linter = await new NpmGroovyLint(npmGroovyLintConfig, {}).run();

        assert(linter.status === 1, `Linter status is 1 (${linter.status} returned)`);
        assert(
            linter.lintResult.summary.totalFixedNumber >= expectedFixedErrs,
            `${expectedFixedErrs} errors have been fixed (${linter.lintResult.summary.totalFixedNumber} returned)`
        );
        assert(linter.lintResult.files[0].updatedSource && linter.lintResult.files[0].updatedSource !== prevFileContent, "Source has been updated");
        assert(!linter.outputString.includes("NaN"), "Results does not contain NaN");
        checkCodeNarcCallsCounter(1);
    }).timeout(200000);

    it("(API:file) should lint and fix a Jenkinsfile in one shot", async function() {
        const tmpDir = await copyFilesInTmpDir();
        try {
            const prevFileContent = fse.readFileSync(tmpDir + "/Jenkinsfile").toString();
            const linter = await new NpmGroovyLint(
                [
                    process.execPath,
                    "",
                    "--output",
                    '"npm-groovy-fix-log.json"',
                    "--path",
                    '"' + tmpDir + '"',
                    "--files",
                    "**/Jenkinsfile",
                    "--nolintafter",
                    "--fix",
                    "--no-insight",
                    "--verbose"
                ],
                {}
            ).run();

            assert(linter.status === 1, `Linter status is 1 (${linter.status} returned)`);
            assert(linter.lintResult.summary.totalFixedNumber > 0, "Error have been fixed");
            assert(linter.lintResult.files[Object.keys(linter.lintResult.files)[0]].updatedSource !== prevFileContent, "File content has been updated");
            assert(fse.existsSync("npm-groovy-fix-log.json"), "Output json file has been produced");
            assert(!linter.outputString.includes("NaN"), "Results does not contain NaN");
            checkCodeNarcCallsCounter(2);
        } finally {
            fse.removeSync("npm-groovy-fix-log.json");
            rimraf.sync(tmpDir);
        }
    }).timeout(120000);

    it("(API:file) should fix only some errors", async function() {
        const fixRules = [
            // Line rules or not changing line rules

            "Indentation", // ok
            // "UnnecessaryGString",
            // "SpaceBeforeOpeningBrace",
            // "SpaceAfterOpeningBrace",
            // "SpaceAfterCatch",
            // "SpaceAroundOperator",
            // "SpaceAfterComma",
            // "UnnecessaryDefInFieldDeclaration",
            "UnnecessarySemicolon"
            // "IfStatementBraces",
            // "ElseStatementBraces",
            // "ConsecutiveBlankLines",
            // "IndentationClosingBraces",
            // "IndentationComments",
            // "FileEndsWithoutNewline" // ok
        ];
        const tmpDir = await copyFilesInTmpDir();
        try {
            const linter = await new NpmGroovyLint(
                [
                    process.execPath,
                    "",
                    "--path",
                    '"' + tmpDir + '"',
                    "--fix",
                    "--fixrules",
                    fixRules.join(","),
                    "--nolintafter",
                    "--output",
                    '"npm-groovy-fix-log-should-fix-only-some-errors.txt"',
                    "--failon", "none",
                    "--no-insight",
                    "--verbose"
                ],
                {}
            ).run();

            assert(linter.status === 0);
            assert(linter.lintResult.summary.totalFixedNumber > 0, "Errors have been fixed");
            assert(fse.existsSync("npm-groovy-fix-log-should-fix-only-some-errors.txt"), "Output txt file produced");
            assert(!linter.outputString.includes("NaN"), "Results does not contain NaN");
            checkCodeNarcCallsCounter(1);
        } finally {
            fse.removeSync("npm-groovy-fix-log-should-fix-only-some-errors.txt");
            rimraf.sync(tmpDir);
        }
    }).timeout(120000);

    it("(API:file) should fix groovy files", async function() {
        const tmpDir = await copyFilesInTmpDir();
        try {
            const linter = await new NpmGroovyLint(
                [
                    process.execPath,
                    "",
                    "--path",
                    '"' + tmpDir + '"',
                    "--output",
                    '"npm-groovy-fix-log-should-fix-groovy-files.txt"',
                    "--fix",
                    "--nolintafter",
                    "--no-insight",
                    "--verbose"
                ],
                {}
            ).run();

            assert(linter.status === 1, `Linter status is 1 (${linter.status} returned)`);
            assert(linter.lintResult.summary.totalFixedNumber > 0, "Errors have been fixed");
            assert(fse.existsSync("npm-groovy-fix-log-should-fix-groovy-files.txt"), "Output txt file produced");
            assert(!linter.outputString.includes("NaN"), "Results does not contain NaN");
            checkCodeNarcCallsCounter(2);
        } finally {
            fse.removeSync("npm-groovy-fix-log-should-fix-groovy-files.txt");
            rimraf.sync(tmpDir);
        }
    }).timeout(120000);
});
