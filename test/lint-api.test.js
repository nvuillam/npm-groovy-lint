#! /usr/bin/env node
"use strict";
const NpmGroovyLint = require("../lib/groovy-lint.js");
let assert = require("assert");
const c = require("ansi-colors");
const fse = require("fs-extra");
const path = require("path");
const {
    beforeEachTestCase,
    checkCodeNarcCallsCounter,
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

    it("(API:file) should generate text console output ans stats", async () => {
        const linter = await new NpmGroovyLint([process.execPath, "", "--path", '"lib/example"', "--files", "**/" + SAMPLE_FILE_SMALL, "--verbose"], {
            verbose: true
        }).run();
        assert(linter.status === 0, `Linter status is 0 (${linter.status} returned)`);
        assert(linter.outputString.includes("warning"), "Output string contains warning");
        assert(linter.lintResult.summary.totalFoundWarningNumber > 0, "Warnings found");
        assert(linter.lintResult.summary.totalFoundInfoNumber > 0, "Infos found");
        checkCodeNarcCallsCounter(1);
    });

    it("(API:file) should generate text console output with loglevel=warning", async () => {
        const linter = await new NpmGroovyLint(
            [process.execPath, "", "--path", '"lib/example"', "--files", "**/" + SAMPLE_FILE_SMALL, "--loglevel", "warning", "--verbose"],
            {
                verbose: true
            }
        ).run();
        assert(linter.status === 0, `Linter status is 0 (${linter.status} returned)`);
        assert(linter.outputString.includes("warning"), "Output string contains warning");
        assert(!linter.outputString.includes("info"), "Output string should not contain info");
        assert(linter.lintResult.summary.totalFoundWarningNumber > 0, "Warnings found");
        checkCodeNarcCallsCounter(1);
    });

    it("(API:file) should generate json output with rules", async () => {
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
                "--no-insight",
                "--loglevel",
                "warning"
            ],
            {}
        ).run();
        assert(linter.status === 0, `Linter status is 0 (${linter.status} returned)`);
        assert(linter.outputString.includes(`"totalFoundWarningNumber":`), "Property totalFoundWarningNumber is in result");
        assert(linter.lintResult.summary.totalFoundWarningNumber > 0, "Warnings found");
        checkCodeNarcCallsCounter(1);
    });

    it("(API:file) should generate SARIF output", async () => {
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
                "--no-insight",
                "--loglevel",
                "warning"
            ],
            {}
        ).run();
        assert(linter.status === 0, `Linter status is 0 (${linter.status} returned)`);
        const sarifLog = JSON.parse(linter.outputString);
        assert(sarifLog.runs, "SARIF has runs");
        checkCodeNarcCallsCounter(1);
    });

    it("(API:file) should generate codenarc HTML file report", async () => {
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

    it("(API:file) should generate codenarc XML file report", async () => {
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

    it("(API:file) should use --codenarcargs to generate XML report", async () => {
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

    it("(API:file) should run on a Jenkinsfile", async () => {
        const linter = await new NpmGroovyLint(
            [process.execPath, "", "--path", '"lib/example"', "-f", "**/Jenkinsfile", "-c", "recommended-jenkinsfile", "--no-insight", "--verbose"],
            {
                verbose: true
            }
        ).run();
        assert(linter.status === 0, `Linter status is 0 (${linter.status} returned)`);
        assert(linter.outputString.includes("warning"), "Output string contains warning");
        assert(linter.lintResult.summary.totalFoundWarningNumber > 0, "Warnings found");
        assert(linter.lintResult.summary.totalFoundInfoNumber > 0, "Infos found");
        checkCodeNarcCallsCounter(1);
    });

    it("(API:files) should ignore fake_node_modules pattern", async () => {
        const lintedFilesNb = 11;
        const npmGroovyLintConfig = {
            files: "**/*.groovy",
            ignorepattern: "**/fake_node_modules/**",
            output: "txt",
            insight: false,
            verbose: true
        };
        const linter = await new NpmGroovyLint(npmGroovyLintConfig, {}).run();
        assert(!linter.outputString.includes(`ToIgnore.groovy`), "ToIgnore.groovy has been ignored");
        assert(
            linter.outputString.includes(`npm-groovy-lint results in ${c.bold(lintedFilesNb)} linted files`),
            `Number of linted files is displayed in summary: ${c.bold(lintedFilesNb)}`
        );
    });

    it("(API:source) should run with source only (no parsing)", async () => {
        const npmGroovyLintConfig = {
            source: fse.readFileSync(SAMPLE_FILE_SMALL_PATH).toString(),
            sourcefilepath: SAMPLE_FILE_SMALL_PATH,
            insight: false,
            output: "txt",
            verbose: true
        };
        const linter = await new NpmGroovyLint(npmGroovyLintConfig, {}).run();
        assert(linter.status === 0, `Linter status is 0 (${linter.status} returned)`);
        assert(linter.lintResult.files[0].errors.length > 0, "Errors have been found");
        checkCodeNarcCallsCounter(1);
    });

    it("(API:source) should run with CodeNarc ruleset file", async () => {
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
        assert(linter.status === 0, `Linter status is 0 (${linter.status} returned)`);
        assert(linter.lintResult.files[0].errors.length > 0, "Errors have been found");
        checkCodeNarcCallsCounter(1);
    });

    it("(API:source) should run with source only (parse success)", async () => {
        const npmGroovyLintConfig = {
            source: fse.readFileSync(SAMPLE_FILE_SMALL_PATH).toString(),
            sourcefilepath: SAMPLE_FILE_SMALL_PATH,
            output: "txt",
            insight: false,
            parse: true,
            verbose: true
        };
        const linter = await new NpmGroovyLint(npmGroovyLintConfig, {}).run();
        assert(linter.status === 0, `Linter status is 0 (${linter.status} returned)`);
        assert(linter.lintResult.files[0].errors.length > 0, "Errors have been found");
        checkCodeNarcCallsCounter(1);
    });

    it("(API:source) should run with source only (file with spaces)", async () => {
        const npmGroovyLintConfig = {
            source: fse.readFileSync(SAMPLE_FILE_WITH_SPACES_PATH).toString(),
            sourcefilepath: SAMPLE_FILE_WITH_SPACES_PATH,
            output: "txt",
            insight: false,
            parse: true,
            verbose: true
        };
        const linter = await new NpmGroovyLint(npmGroovyLintConfig, {}).run();
        assert(linter.status === 0, `Linter status is 0 (${linter.status} returned)`);
        assert(linter.lintResult.files[0].errors.length > 0, "Errors have been found");
        checkCodeNarcCallsCounter(1);
    });

    it("(API:source) should run with source only (parse error)", async () => {
        const npmGroovyLintConfig = {
            source: fse.readFileSync(SAMPLE_FILE_PARSE_ERROR_PATH).toString(),
            sourcefilepath: SAMPLE_FILE_PARSE_ERROR_PATH,
            output: "txt",
            insight: false,
            verbose: true
        };
        const linter = await new NpmGroovyLint(npmGroovyLintConfig, {}).run();
        assert(linter.status === 0, `Linter status is 0 (${linter.status} returned)`);
        assert(linter.lintResult.files[0].errors.length > 0, "Errors have been found");
        assert(linter.outputString.includes("NglParseError"), "Parse error has been detected");
        checkCodeNarcCallsCounter(1);
    });

    it("(API:source) should run without CodeNarc Server", async () => {
        const npmGroovyLintConfig = {
            source: fse.readFileSync(SAMPLE_FILE_SMALL_PATH).toString(),
            sourcefilepath: SAMPLE_FILE_SMALL_PATH,
            noserver: true,
            output: "none",
            insight: false,
            verbose: true
        };
        const linter = await new NpmGroovyLint(npmGroovyLintConfig, {}).run();
        assert(linter.status === 0, `Linter status is 0 (${linter.status} returned)`);
        assert(linter.lintResult.files[0].errors.length > 0, "Errors have been found");
        checkCodeNarcCallsCounter(1);
    });

    it("(API:file) should run on a list of files", async () => {
        const linter = await new NpmGroovyLint([
            process.execPath,
            "",
            "--verbose",
            SAMPLE_FILE_SMALL,
            SAMPLE_FILE_WITH_SPACES
        ], {
            verbose: true
        }).run();
        assert(linter.status === 0, `Linter status is 0 (${linter.status} returned)`);
        assert(linter.outputString.includes("warning"), "Output string contains warning");
        assert(linter.lintResult.summary.totalFoundWarningNumber > 0, "Warnings found");
        assert(linter.lintResult.summary.totalFoundInfoNumber > 0, "Infos found");
        checkCodeNarcCallsCounter(1);
    });

    it("(API:file) should run on a directory", async () => {
        const linter = await new NpmGroovyLint([
            process.execPath,
            "",
            "--verbose",
            EXAMPLE_DIRECTORY
        ], {
            verbose: true
        }).run();
        assert(linter.status === 0, `Linter status is 0 (${linter.status} returned)`);
        assert(linter.outputString.includes("warning"), "Output string contains warning");
        assert(linter.lintResult.summary.totalFoundWarningNumber > 0, "Warnings found");
        assert(linter.lintResult.summary.totalFoundInfoNumber > 0, "Infos found");
        checkCodeNarcCallsCounter(1);
    });
});
