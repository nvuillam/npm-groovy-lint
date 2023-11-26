#! /usr/bin/env node
"use strict";
const NpmGroovyLint = require("../lib/groovy-lint.js");
let assert = require("assert");
const fse = require("fs-extra");
const path = require("path");
const {
    beforeEachTestCase,
    checkCodeNarcCallsCounter,
    assertLintedFiles,
    SAMPLE_FILE_PARSE_ERROR_PATH,
    SAMPLE_FILE_SMALL,
    SAMPLE_FILE_SMALL_PATH,
    SAMPLE_FILE_WITH_SPACES,
    SAMPLE_FILE_WITH_SPACES_PATH,
    SAMPLE_RULESET_1_PATH,
    SAMPLE_RULESET_2_PATH,
    EXAMPLE_DIRECTORY
} = require("./helpers/common");

describe("Lint with API", () => {
    beforeEach(beforeEachTestCase);

    it("(API:file) should generate text console output and stats", async function() {
        const linter = await new NpmGroovyLint([process.execPath, "", "--path", '"lib/example"', "--files", "**/" + SAMPLE_FILE_SMALL, "--verbose"], {
            verbose: true
        }).run();
        assert(linter.status === 1, `Linter status is 1 (${linter.status} returned)`);
        assert(linter.outputString.includes("warning"), "Output string contains warning");
        assert(linter.lintResult.summary.totalFoundWarningNumber > 0, "Warnings found");
        assert(linter.lintResult.summary.totalFoundInfoNumber > 0, "Infos found");
        checkCodeNarcCallsCounter(1);
    });

    it("(API:file) should generate text console output with loglevel=warning", async function() {
        const linter = await new NpmGroovyLint(
            [process.execPath, "", "--path", '"lib/example"', "--files", "**/" + SAMPLE_FILE_SMALL, "--loglevel", "warning",
                "--failon", "warning", "--verbose"],
            {
                verbose: true
            }
        ).run();
        assert(linter.status === 1, `Linter status is 1 (${linter.status} returned)`);
        assert(linter.outputString.includes("warning"), "Output string contains warning");
        assert(!linter.outputString.includes("info"), "Output string should not contain info");
        assert(linter.lintResult.summary.totalFoundWarningNumber > 0, "Warnings found");
        checkCodeNarcCallsCounter(1);
    });

    it("(API:file) should generate json output with rules", async function() {
        const linter = await new NpmGroovyLint(
            [
                process.execPath,
                "",
                "--path",
                '"lib/example"',
                "--files",
                "**/" + SAMPLE_FILE_SMALL,
                "--output",
                "json",
                "--no-insight"
            ],
            {}
        ).run();
        assert(linter.status === 1, `Linter status is 1 (${linter.status} returned)`);
        assert(linter.outputString.includes(`"totalFoundWarningNumber":`), "Property totalFoundWarningNumber is in result");
        assert(linter.lintResult.summary.totalFoundWarningNumber > 0, "Warnings found");
        checkCodeNarcCallsCounter(1);
    });

    it("(API:file) should generate SARIF output", async function() {
        const linter = await new NpmGroovyLint(
            [
                process.execPath,
                "",
                "--path",
                '"lib/example"',
                "--files",
                "**/" + SAMPLE_FILE_SMALL,
                "--output",
                "sarif",
                "--no-insight"
            ],
            {}
        ).run();
        assert(linter.status === 1, `Linter status is 1 (${linter.status} returned)`);
        const sarifLog = JSON.parse(linter.outputString);
        assert(sarifLog.runs, "SARIF has runs");
        checkCodeNarcCallsCounter(1);
    });

    it("(API:file) should generate codenarc HTML file report", async function() {
        const reportFileName = path.resolve("./tmp/ReportTestCodenarc.html");
        const linter = await new NpmGroovyLint(
            [process.execPath, "", "--path", "./lib/example", "--files", "**/" + SAMPLE_FILE_SMALL, "--no-insight", "--output", reportFileName],
            {}
        ).run();

        assert(linter.status === 0, `Linter status is 0 (${linter.status} returned)`);
        assert(fse.existsSync(reportFileName), `CodeNarc HTML report generated at ${reportFileName}`);
        fse.removeSync(reportFileName);
        checkCodeNarcCallsCounter(1);
    });

    it("(API:file) should generate codenarc XML file report", async function() {
        const reportFileName = path.resolve("./tmp/ReportTestCodenarc.xml");
        const linter = await new NpmGroovyLint(
            [process.execPath, "", "--path", "lib/example", "--files", "**/" + SAMPLE_FILE_SMALL, "--no-insight", "--output", reportFileName],
            {}
        ).run();

        assert(linter.status === 0, `Linter status is 0 (${linter.status} returned)`);
        assert(fse.existsSync(reportFileName), `CodeNarc XML report generated at ${path.resolve(reportFileName)}`);
        fse.removeSync(reportFileName);
        checkCodeNarcCallsCounter(1);
    });

    it("(API:file) should use --codenarcargs to generate XML report", async function() {
        const reportFileName = path.resolve("./tmp/ReportTestCodenarc.xml");
        const linter = await new NpmGroovyLint(
            [
                process.execPath,
                "",
                "--codenarcargs",
                `-basedir="${path.resolve("lib/example")}"`,
                '-title="TestTitleCodenarc"',
                "-maxPriority1Violations=0",
                `-report="xml:${reportFileName}"`
            ],
            {}
        ).run();

        assert(linter.status === 0, `Linter status is 0 (${linter.status} returned)`);
        assert(fse.existsSync(reportFileName), `XML HTML report generated at ${path.resolve(reportFileName)}`);
        fse.removeSync(reportFileName);
        checkCodeNarcCallsCounter(1);
    });

    it("(API:file) should run on a Jenkinsfile", async function() {
        const linter = await new NpmGroovyLint(
            [process.execPath, "", "--path", '"lib/example"', "-f", "**/Jenkinsfile", "-c", "recommended-jenkinsfile", "--no-insight", "--verbose"],
            {
                verbose: true
            }
        ).run();
        assert(linter.status === 1, `Linter status is 1 (${linter.status} returned)`);
        assert(linter.outputString.includes("warning"), "Output string contains warning");
        assert(linter.lintResult.summary.totalFoundWarningNumber > 0, "Warnings found");
        assert(linter.lintResult.summary.totalFoundInfoNumber > 0, "Infos found");
        checkCodeNarcCallsCounter(1);
    });

    it("(API:files) should ignore fake_node_modules and groovy pattern", async function() {
        const npmGroovyLintConfig = {
            files: "**/*.groovy",
            ignorepattern: "**/fake_node_modules/**,**/groovy/**",
            output: "txt",
            insight: false,
            verbose: true
        };
        const linter = await new NpmGroovyLint(npmGroovyLintConfig, {}).run();
        assert(linter.status === 1, `Expected linter status is 1 got ${linter.status}`);
        assertLintedFiles(linter.outputString, 11);
    });

    it("(API:source) should run with source only (no parsing)", async function() {
        const npmGroovyLintConfig = {
            source: fse.readFileSync(SAMPLE_FILE_SMALL_PATH).toString(),
            sourcefilepath: SAMPLE_FILE_SMALL_PATH,
            insight: false,
            output: "txt",
            verbose: true
        };
        const linter = await new NpmGroovyLint(npmGroovyLintConfig, {}).run();
        assert(linter.status === 1, `Linter status is 1 (${linter.status} returned)`);
        assert(linter.lintResult.files[0].errors.length > 0, "Errors have been found");
        checkCodeNarcCallsCounter(1);
    });

    it("(API:source) should run with CodeNarc ruleset file", async function() {
        const npmGroovyLintConfig = {
            source: fse.readFileSync(SAMPLE_FILE_SMALL_PATH).toString(),
            sourcefilepath: SAMPLE_FILE_SMALL_PATH,
            rulesets: `${SAMPLE_RULESET_1_PATH},${SAMPLE_RULESET_2_PATH}`,
            output: "txt",
            insight: false,
            parse: true,
            verbose: true
        };
        const linter = await new NpmGroovyLint(npmGroovyLintConfig, {}).run();
        assert(linter.status === 1, `Linter status is 1 (${linter.status} returned)`);
        assert(linter.lintResult.files[0].errors.length > 0, "Errors have been found");
        checkCodeNarcCallsCounter(1);
    });

    it("(API:source) should run with source only (parse success)", async function() {
        const npmGroovyLintConfig = {
            source: fse.readFileSync(SAMPLE_FILE_SMALL_PATH).toString(),
            sourcefilepath: SAMPLE_FILE_SMALL_PATH,
            output: "txt",
            insight: false,
            parse: true,
            verbose: true
        };
        const linter = await new NpmGroovyLint(npmGroovyLintConfig, {}).run();
        assert(linter.status === 1, `Linter status is 1 (${linter.status} returned)`);
        assert(linter.lintResult.files[0].errors.length > 0, "Errors have been found");
        checkCodeNarcCallsCounter(1);
    });

    it("(API:source) should run with source only (file with spaces)", async function() {
        const npmGroovyLintConfig = {
            source: fse.readFileSync(SAMPLE_FILE_WITH_SPACES_PATH).toString(),
            sourcefilepath: SAMPLE_FILE_WITH_SPACES_PATH,
            output: "txt",
            insight: false,
            parse: true,
            verbose: true
        };
        const linter = await new NpmGroovyLint(npmGroovyLintConfig, {}).run();
        assert(linter.status === 1, `Linter status is 1 (${linter.status} returned)`);
        assert(linter.lintResult.files[0].errors.length > 0, "Errors have been found");
        checkCodeNarcCallsCounter(1);
    });

    it("(API:source) should run with source only (parse error)", async function() {
        const npmGroovyLintConfig = {
            source: fse.readFileSync(SAMPLE_FILE_PARSE_ERROR_PATH).toString(),
            sourcefilepath: SAMPLE_FILE_PARSE_ERROR_PATH,
            output: "txt",
            insight: false,
            verbose: true
        };
        const linter = await new NpmGroovyLint(npmGroovyLintConfig, {}).run();
        assert(linter.status === 1, `Linter status is 1 (${linter.status} returned)`);
        assert(linter.lintResult.summary.totalFilesLinted === 1, `Expected 1 file linted got ${linter.lintResult.summary.totalFilesLinted}`);
        assert(linter.lintResult.summary.totalFoundInfoNumber === 1, `Expected 1 info got ${linter.lintResult.summary.totalFoundInfoNumber}`);
        assert(linter.lintResult.files[0].errors.length === 2, `Expected 2 errors got ${linter.lintResult.files[0].errors.length}`);
        assert(linter.outputString.includes("NglParseError"), `Expected NglParseError got ${linter.outputString}`);
        checkCodeNarcCallsCounter(1);
    });

    it("(API:source) should run without CodeNarc Server", async function() {
        const npmGroovyLintConfig = {
            source: fse.readFileSync(SAMPLE_FILE_SMALL_PATH).toString(),
            sourcefilepath: SAMPLE_FILE_SMALL_PATH,
            noserver: true,
            output: "none",
            insight: false,
            verbose: true
        };
        const linter = await new NpmGroovyLint(npmGroovyLintConfig, {}).run();
        assert(linter.status === 1, `Linter status is 1 (${linter.status} returned)`);
        assert(linter.lintResult.files[0].errors.length > 0, "Errors have been found");
        checkCodeNarcCallsCounter(1);
    });

    it("(API:file) should run on a single file (relative)", async function() {
        const linter = await new NpmGroovyLint([
            process.execPath,
            "",
            "--verbose",
            path.join("./lib/example", SAMPLE_FILE_SMALL)
        ], {
            verbose: true
        }).run();
        assert(linter.status === 1, `Linter status is 1 (${linter.status} returned)`);
        assert(linter.outputString.includes("warning"), "Output string contains warning");
        assert(linter.lintResult.summary.totalFoundWarningNumber > 0, "Warnings found");
        assert(linter.lintResult.summary.totalFoundInfoNumber > 0, "Infos found");
        checkCodeNarcCallsCounter(1);
    });

    it("(API:file) should run on a single file (absolute)", async function() {
        const linter = await new NpmGroovyLint([
            process.execPath,
            "",
            "--verbose",
            path.resolve(path.join("./lib/example", SAMPLE_FILE_SMALL))
        ], {
            verbose: true
        }).run();
        assert(linter.status === 1, `Linter status is 1 (${linter.status} returned)`);
        assert(linter.outputString.includes("warning"), "Output string contains warning");
        assert(linter.lintResult.summary.totalFoundWarningNumber > 0, "Warnings found");
        assert(linter.lintResult.summary.totalFoundInfoNumber > 0, "Infos found");
        checkCodeNarcCallsCounter(1);
    });

    it("(API:file) should run on a list of files (relative)", async function() {
        const linter = await new NpmGroovyLint([
            process.execPath,
            "",
            "--verbose",
            path.join("./lib/example", SAMPLE_FILE_SMALL),
            path.join("./lib/example", SAMPLE_FILE_WITH_SPACES)
        ], {
            verbose: true
        }).run();
        assert(linter.status === 1, `Linter status is 1 (${linter.status} returned)`);
        assert(linter.outputString.includes("warning"), "Output string contains warning");
        assert(linter.lintResult.summary.totalFoundWarningNumber > 0, "Warnings found");
        assert(linter.lintResult.summary.totalFoundInfoNumber > 0, "Infos found");
        checkCodeNarcCallsCounter(1);
    });

    it("(API:file) should run on a list of files (absolute)", async function() {
        const linter = await new NpmGroovyLint([
            process.execPath,
            "",
            "--verbose",
            path.resolve(path.join("./lib/example", SAMPLE_FILE_SMALL)),
            path.resolve(path.join("./lib/example", SAMPLE_FILE_WITH_SPACES))
        ], {
            verbose: true
        }).run();
        assert(linter.status === 1, `Linter status is 1 (${linter.status} returned)`);
        assert(linter.outputString.includes("warning"), "Output string contains warning");
        assert(Object.keys(linter.lintResult.files).length === 2, "Files array contains 2 files");
        assert(linter.lintResult.summary.totalFoundErrorNumber === 4, "Error found");
        assert(linter.lintResult.summary.totalFoundWarningNumber === 6, "Warnings found");
        assert(linter.lintResult.summary.totalFoundInfoNumber === 65, "Infos found");
        checkCodeNarcCallsCounter(1);
    });

    it("(API:file) should run on a list of files, no server (relative)", async function() {
        const linter = await new NpmGroovyLint([
            process.execPath,
            "",
            "--verbose",
            "--noserver",
            path.join("./lib/example", SAMPLE_FILE_SMALL),
            path.join("./lib/example", SAMPLE_FILE_WITH_SPACES)
        ], {
            verbose: true
        }).run();
        assert(linter.status === 1, `Linter status is 1 (${linter.status} returned)`);
        assert(linter.outputString.includes("warning"), "Output string contains warning");
        assert(linter.lintResult.summary.totalFoundWarningNumber > 0, "Warnings found");
        assert(linter.lintResult.summary.totalFoundInfoNumber > 0, "Infos found");
        checkCodeNarcCallsCounter(1);
    });

    it("(API:file) should run on a list of files, no server (absolute)", async function() {
        const linter = await new NpmGroovyLint([
            process.execPath,
            "",
            "--verbose",
            "--noserver",
            path.resolve(path.join("./lib/example", SAMPLE_FILE_SMALL)),
            path.resolve(path.join("./lib/example", SAMPLE_FILE_WITH_SPACES))
        ], {
            verbose: true
        }).run();
        assert(linter.status === 1, `Linter status is 1 (${linter.status} returned)`);
        assert(linter.outputString.includes("warning"), "Output string contains warning");
        assert(Object.keys(linter.lintResult.files).length === 2, "Files array contains 2 files");
        assert(linter.lintResult.summary.totalFoundErrorNumber === 4, "Error found");
        assert(linter.lintResult.summary.totalFoundWarningNumber === 6, "Warnings found");
        assert(linter.lintResult.summary.totalFoundInfoNumber === 65, "Infos found");
        checkCodeNarcCallsCounter(1);
    });

    it("(API:file) should run on a directory", async function() {
        const linter = await new NpmGroovyLint([
            process.execPath,
            "",
            "--verbose",
            EXAMPLE_DIRECTORY
        ], {
            verbose: true
        }).run();
        assert(linter.status === 1, `Linter status is 1 (${linter.status} returned)`);
        assert(linter.outputString.includes("warning"), "Output string contains warning");
        assert(Object.keys(linter.lintResult.files).length === 12, `Expected 2 files got ${Object.keys(linter.lintResult.files).length}`);
        assert(linter.lintResult.summary.totalFoundErrorNumber === 12, `Expected 12 errors to ${linter.lintResult.summary.totalFoundErrorNumber}`);
        assert(linter.lintResult.summary.totalFoundWarningNumber === 333, `Expected 333 warnings to ${linter.lintResult.summary.totalFoundWarningNumber}`);
        assert(linter.lintResult.summary.totalFoundInfoNumber === 1649, `Expected 1649 infos to ${linter.lintResult.summary.totalFoundInfoNumber}`);
        checkCodeNarcCallsCounter(1);
    });
});
