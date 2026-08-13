#! /usr/bin/env node
import NpmGroovyLint from "../lib/groovy-lint.js";
import assert from "assert";
import fs from "node:fs";
import os from "node:os";
import * as path from "path";
import {
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
    EXAMPLE_DIRECTORY,
} from "./helpers/common.js";

describe("Lint with API", () => {
    beforeEach(beforeEachTestCase);

    it("(API:file) should generate text console output and stats", async function () {
        const linter = await new NpmGroovyLint([process.execPath, "", "--path", '"lib/example"', "--files", "**/" + SAMPLE_FILE_SMALL, "--verbose"], {
            verbose: true,
        }).run();
        assert(linter.status === 1, `Linter status is 1 (${linter.status} returned)`);
        assert(linter.outputString.includes("warning"), "Output string contains warning");
        assert(linter.lintResult.summary.totalFoundWarningNumber > 0, "Warnings found");
        assert(linter.lintResult.summary.totalFoundInfoNumber > 0, "Infos found");
        checkCodeNarcCallsCounter(1);
    });

    it("(API:file) should generate text console output with loglevel=warning", async function () {
        const linter = await new NpmGroovyLint(
            [
                process.execPath,
                "",
                "--path",
                '"lib/example"',
                "--files",
                "**/" + SAMPLE_FILE_SMALL,
                "--loglevel",
                "warning",
                "--failon",
                "warning",
                "--verbose",
            ],
            {
                verbose: true,
            },
        ).run();
        assert(linter.status === 1, `Linter status is 1 (${linter.status} returned)`);
        assert(linter.outputString.includes("warning"), "Output string contains warning");
        assert(!linter.outputString.includes("info"), "Output string should not contain info");
        assert(linter.lintResult.summary.totalFoundWarningNumber > 0, "Warnings found");
        checkCodeNarcCallsCounter(1);
    });

    it("(API:file) should generate json output with rules", async function () {
        const linter = await new NpmGroovyLint(
            [process.execPath, "", "--path", '"lib/example"', "--files", "**/" + SAMPLE_FILE_SMALL, "--output", "json", "--no-insight"],
            {},
        ).run();
        assert(linter.status === 1, `Linter status is 1 (${linter.status} returned)`);
        assert(linter.outputString.includes(`"totalFoundWarningNumber":`), "Property totalFoundWarningNumber is in result");
        assert(linter.lintResult.summary.totalFoundWarningNumber > 0, "Warnings found");
        checkCodeNarcCallsCounter(1);
    });

    it("(API:file) should generate SARIF output", async function () {
        const linter = await new NpmGroovyLint(
            [process.execPath, "", "--path", '"lib/example"', "--files", "**/" + SAMPLE_FILE_SMALL, "--output", "sarif", "--no-insight"],
            {},
        ).run();
        assert(linter.status === 1, `Linter status is 1 (${linter.status} returned)`);
        const sarifLog = JSON.parse(linter.outputString);
        assert(sarifLog.runs, "SARIF has runs");
        checkCodeNarcCallsCounter(1);
    });

    it("(API:file) should generate codenarc HTML file report", async function () {
        const reportFileName = path.resolve("./tmp/ReportTestCodenarc.html");
        const linter = await new NpmGroovyLint(
            [process.execPath, "", "--path", "./lib/example", "--files", "**/" + SAMPLE_FILE_SMALL, "--no-insight", "--output", reportFileName],
            {},
        ).run();

        assert(linter.status === 0, `Linter status is 0 (${linter.status} returned)`);
        assert(fs.existsSync(reportFileName), `CodeNarc HTML report generated at ${reportFileName}`);
        fs.rmSync(reportFileName, { recursive: true, force: true });
        checkCodeNarcCallsCounter(1);
    });

    it("(API:file) should generate codenarc XML file report", async function () {
        const reportFileName = path.resolve("./tmp/ReportTestCodenarc.xml");
        const linter = await new NpmGroovyLint(
            [process.execPath, "", "--path", "lib/example", "--files", "**/" + SAMPLE_FILE_SMALL, "--no-insight", "--output", reportFileName],
            {},
        ).run();

        assert(linter.status === 0, `Linter status is 0 (${linter.status} returned)`);
        assert(fs.existsSync(reportFileName), `CodeNarc XML report generated at ${path.resolve(reportFileName)}`);
        fs.rmSync(reportFileName, { recursive: true, force: true });
        checkCodeNarcCallsCounter(1);
    });

    it("(API:file) should use --codenarcargs to generate XML report", async function () {
        const reportFileName = path.resolve("./tmp/ReportTestCodenarc.xml");
        const linter = await new NpmGroovyLint(
            [
                process.execPath,
                "",
                "--codenarcargs",
                `-basedir="${path.resolve("lib/example")}"`,
                '-title="TestTitleCodenarc"',
                "-maxPriority1Violations=0",
                `-report="xml:${reportFileName}"`,
            ],
            {},
        ).run();

        assert(linter.status === 0, `Linter status is 0 (${linter.status} returned)`);
        assert(fs.existsSync(reportFileName), `XML HTML report generated at ${path.resolve(reportFileName)}`);
        fs.rmSync(reportFileName, { recursive: true, force: true });
        checkCodeNarcCallsCounter(1);
    });

    it("(API:file) should run on a Jenkinsfile", async function () {
        // The sample pipeline holds no likely mistake, so the default preset reports nothing on it
        const linter = await new NpmGroovyLint(
            [process.execPath, "", "--path", '"lib/example"', "-f", "**/Jenkinsfile", "-c", "recommended-jenkinsfile", "--no-insight", "--verbose"],
            {
                verbose: true,
            },
        ).run();
        assert(linter.status === 0, `Linter status is 0 (${linter.status} returned)`);
        assert(linter.lintResult.summary.totalFilesLinted === 1, `Expected 1 file linted got ${linter.lintResult.summary.totalFilesLinted}`);
        checkCodeNarcCallsCounter(1);
    });

    it("(API:file) should run on a Jenkinsfile with the jenkinsfile add-on over advanced", async function () {
        // The add-on is what makes a strict preset usable on a pipeline: it must relax the
        // dynamic-typing and naming rules `advanced` would otherwise report on every step
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ngl-jenkinsfile-"));
        try {
            const configFilePath = path.join(tmpDir, ".groovylintrc.json");
            fs.writeFileSync(configFilePath, JSON.stringify({ extends: ["advanced", "jenkinsfile"] }));
            const linter = await new NpmGroovyLint(
                [process.execPath, "", "--path", '"lib/example"', "-f", "**/Jenkinsfile", "-c", configFilePath, "--no-insight", "--verbose"],
                {
                    verbose: true,
                },
            ).run();
            assert(linter.status === 1, `Linter status is 1 (${linter.status} returned)`);
            assert(linter.lintResult.summary.totalFoundWarningNumber > 0, "Warnings found");
            const rulesFound = new Set(
                Object.values(linter.lintResult.files)
                    .flatMap((file) => file.errors)
                    .map((error) => error.rule),
            );
            for (const relaxedRule of ["NoDef", "VariableName", "VariableTypeRequired", "UnnecessaryGetter"]) {
                assert(!rulesFound.has(relaxedRule), `${relaxedRule} must be switched off by the jenkinsfile add-on`);
            }
            checkCodeNarcCallsCounter(1);
        } finally {
            fs.rmSync(tmpDir, { recursive: true, force: true });
        }
    });

    it("(API:files) should ignore fake_node_modules and groovy pattern", async function () {
        const npmGroovyLintConfig = {
            files: "**/*.groovy",
            ignorepattern: "**/fake_node_modules/**,**/groovy/**",
            output: "txt",
            insight: false,
            verbose: true,
        };
        const linter = await new NpmGroovyLint(npmGroovyLintConfig, {}).run();
        assert(linter.status === 1, `Expected linter status is 1 got ${linter.status}`);
        // 10, not 11: lib/example/Jenkinsfile does not match **/*.groovy. It used to be
        // linted because the files option was read from the wrong key and silently ignored,
        // so the default patterns (which include Jenkinsfile) applied instead.
        assertLintedFiles(linter.outputString, 10);
    });

    it("(API:source) should run with source only (no parsing)", async function () {
        const npmGroovyLintConfig = {
            source: fs.readFileSync(SAMPLE_FILE_SMALL_PATH).toString(),
            sourcefilepath: SAMPLE_FILE_SMALL_PATH,
            insight: false,
            output: "txt",
            verbose: true,
        };
        const linter = await new NpmGroovyLint(npmGroovyLintConfig, {}).run();
        assert(linter.status === 1, `Linter status is 1 (${linter.status} returned)`);
        assert(linter.lintResult.files[0].errors.length > 0, "Errors have been found");
        checkCodeNarcCallsCounter(1);
    });

    it("(API:source) should run with CodeNarc ruleset file", async function () {
        const npmGroovyLintConfig = {
            source: fs.readFileSync(SAMPLE_FILE_SMALL_PATH).toString(),
            sourcefilepath: SAMPLE_FILE_SMALL_PATH,
            rulesets: `${SAMPLE_RULESET_1_PATH},${SAMPLE_RULESET_2_PATH}`,
            output: "txt",
            insight: false,
            parse: true,
            verbose: true,
        };
        const linter = await new NpmGroovyLint(npmGroovyLintConfig, {}).run();
        assert(linter.status === 1, `Linter status is 1 (${linter.status} returned)`);
        assert(linter.lintResult.files[0].errors.length > 0, "Errors have been found");
        checkCodeNarcCallsCounter(1);
    });

    it("(API:source) should run with source only (parse success)", async function () {
        const npmGroovyLintConfig = {
            source: fs.readFileSync(SAMPLE_FILE_SMALL_PATH).toString(),
            sourcefilepath: SAMPLE_FILE_SMALL_PATH,
            output: "txt",
            insight: false,
            parse: true,
            verbose: true,
        };
        const linter = await new NpmGroovyLint(npmGroovyLintConfig, {}).run();
        assert(linter.status === 1, `Linter status is 1 (${linter.status} returned)`);
        assert(linter.lintResult.files[0].errors.length > 0, "Errors have been found");
        checkCodeNarcCallsCounter(1);
    });

    it("(API:source) should run with source only (file with spaces)", async function () {
        const npmGroovyLintConfig = {
            source: fs.readFileSync(SAMPLE_FILE_WITH_SPACES_PATH).toString(),
            sourcefilepath: SAMPLE_FILE_WITH_SPACES_PATH,
            output: "txt",
            insight: false,
            parse: true,
            verbose: true,
        };
        const linter = await new NpmGroovyLint(npmGroovyLintConfig, {}).run();
        assert(linter.status === 1, `Linter status is 1 (${linter.status} returned)`);
        assert(linter.lintResult.files[0].errors.length > 0, "Errors have been found");
        checkCodeNarcCallsCounter(1);
    });

    it("(API:source) should run with source only (parse error)", async function () {
        const npmGroovyLintConfig = {
            source: fs.readFileSync(SAMPLE_FILE_PARSE_ERROR_PATH).toString(),
            sourcefilepath: SAMPLE_FILE_PARSE_ERROR_PATH,
            output: "txt",
            insight: false,
            verbose: true,
        };
        const linter = await new NpmGroovyLint(npmGroovyLintConfig, {}).run();
        assert(linter.status === 1, `Linter status is 1 (${linter.status} returned)`);
        assert(linter.lintResult.summary.totalFilesLinted === 1, `Expected 1 file linted got ${linter.lintResult.summary.totalFilesLinted}`);
        // The parse error is all the default preset reports here: the rest of the sample is a
        // style matter, which `advanced` covers
        assert(linter.lintResult.files[0].errors.length === 1, `Expected 1 error got ${linter.lintResult.files[0].errors.length}`);
        assert(linter.lintResult.files[0].errors[0].rule === "NglParseError", `Expected NglParseError got ${linter.lintResult.files[0].errors[0].rule}`);
        assert(linter.outputString.includes("NglParseError"), `Expected NglParseError got ${linter.outputString}`);
        checkCodeNarcCallsCounter(1);
    });

    it("(API:source) should run without CodeNarc Server", async function () {
        const npmGroovyLintConfig = {
            source: fs.readFileSync(SAMPLE_FILE_SMALL_PATH).toString(),
            sourcefilepath: SAMPLE_FILE_SMALL_PATH,
            noserver: true,
            output: "none",
            insight: false,
            verbose: true,
        };
        const linter = await new NpmGroovyLint(npmGroovyLintConfig, {}).run();
        assert(linter.status === 1, `Linter status is 1 (${linter.status} returned)`);
        assert(linter.lintResult.files[0].errors.length > 0, "Errors have been found");
        checkCodeNarcCallsCounter(1);
    });

    it("(API:file) should run on a single file (relative)", async function () {
        const linter = await new NpmGroovyLint([process.execPath, "", "--verbose", path.join("./lib/example", SAMPLE_FILE_SMALL)], {
            verbose: true,
        }).run();
        assert(linter.status === 1, `Linter status is 1 (${linter.status} returned)`);
        assert(linter.outputString.includes("warning"), "Output string contains warning");
        assert(linter.lintResult.summary.totalFoundWarningNumber > 0, "Warnings found");
        assert(linter.lintResult.summary.totalFoundInfoNumber > 0, "Infos found");
        checkCodeNarcCallsCounter(1);
    });

    it("(API:file) should run on a single file (absolute)", async function () {
        const linter = await new NpmGroovyLint([process.execPath, "", "--verbose", path.resolve(path.join("./lib/example", SAMPLE_FILE_SMALL))], {
            verbose: true,
        }).run();
        assert(linter.status === 1, `Linter status is 1 (${linter.status} returned)`);
        assert(linter.outputString.includes("warning"), "Output string contains warning");
        assert(linter.lintResult.summary.totalFoundWarningNumber > 0, "Warnings found");
        assert(linter.lintResult.summary.totalFoundInfoNumber > 0, "Infos found");
        checkCodeNarcCallsCounter(1);
    });

    it("(API:file) should run on a list of files (relative)", async function () {
        const linter = await new NpmGroovyLint(
            [process.execPath, "", "--verbose", path.join("./lib/example", SAMPLE_FILE_SMALL), path.join("./lib/example", SAMPLE_FILE_WITH_SPACES)],
            {
                verbose: true,
            },
        ).run();
        assert(linter.status === 1, `Linter status is 1 (${linter.status} returned)`);
        assert(linter.outputString.includes("warning"), "Output string contains warning");
        assert(linter.lintResult.summary.totalFoundWarningNumber > 0, "Warnings found");
        assert(linter.lintResult.summary.totalFoundInfoNumber > 0, "Infos found");
        checkCodeNarcCallsCounter(1);
    });

    it("(API:file) should run on a list of files (absolute)", async function () {
        const linter = await new NpmGroovyLint(
            [
                process.execPath,
                "",
                "--verbose",
                path.resolve(path.join("./lib/example", SAMPLE_FILE_SMALL)),
                path.resolve(path.join("./lib/example", SAMPLE_FILE_WITH_SPACES)),
            ],
            {
                verbose: true,
            },
        ).run();
        assert(linter.status === 1, `Linter status is 1 (${linter.status} returned)`);
        assert(linter.outputString.includes("warning"), "Output string contains warning");
        assert(Object.keys(linter.lintResult.files).length === 2, "Files array contains 2 files");
        assert(linter.lintResult.summary.totalFoundErrorNumber === 4, "Error found");
        assert(linter.lintResult.summary.totalFoundWarningNumber === 4, `Expected 4 warnings got ${linter.lintResult.summary.totalFoundWarningNumber}`);
        assert(linter.lintResult.summary.totalFoundInfoNumber === 5, `Expected 5 infos got ${linter.lintResult.summary.totalFoundInfoNumber}`);
        checkCodeNarcCallsCounter(1);
    });

    it("(API:file) should run on a list of files, no server (relative)", async function () {
        const linter = await new NpmGroovyLint(
            [
                process.execPath,
                "",
                "--verbose",
                "--noserver",
                path.join("./lib/example", SAMPLE_FILE_SMALL),
                path.join("./lib/example", SAMPLE_FILE_WITH_SPACES),
            ],
            {
                verbose: true,
            },
        ).run();
        assert(linter.status === 1, `Linter status is 1 (${linter.status} returned)`);
        assert(linter.outputString.includes("warning"), "Output string contains warning");
        assert(linter.lintResult.summary.totalFoundWarningNumber > 0, "Warnings found");
        assert(linter.lintResult.summary.totalFoundInfoNumber > 0, "Infos found");
        checkCodeNarcCallsCounter(1);
    });

    it("(API:file) should run on a list of files, no server (absolute)", async function () {
        const linter = await new NpmGroovyLint(
            [
                process.execPath,
                "",
                "--verbose",
                "--noserver",
                path.resolve(path.join("./lib/example", SAMPLE_FILE_SMALL)),
                path.resolve(path.join("./lib/example", SAMPLE_FILE_WITH_SPACES)),
            ],
            {
                verbose: true,
            },
        ).run();
        assert(linter.status === 1, `Linter status is 1 (${linter.status} returned)`);
        assert(linter.outputString.includes("warning"), "Output string contains warning");
        assert(Object.keys(linter.lintResult.files).length === 2, "Files array contains 2 files");
        assert(linter.lintResult.summary.totalFoundErrorNumber === 4, "Error found");
        assert(linter.lintResult.summary.totalFoundWarningNumber === 4, `Expected 4 warnings got ${linter.lintResult.summary.totalFoundWarningNumber}`);
        assert(linter.lintResult.summary.totalFoundInfoNumber === 5, `Expected 5 infos got ${linter.lintResult.summary.totalFoundInfoNumber}`);
        checkCodeNarcCallsCounter(1);
    });

    it("(API:file) should restrict linting to the --files patterns", async function () {
        const linter = await new NpmGroovyLint(
            [process.execPath, "", "--path", "lib/example", "--files", "**/" + SAMPLE_FILE_SMALL, "--no-insight"],
            {},
        ).run();
        const lintedFiles = Object.keys(linter.lintResult.files);
        assert(lintedFiles.length === 1, `Expected only ${SAMPLE_FILE_SMALL} to be linted, got ${JSON.stringify(lintedFiles)}`);
        assert(lintedFiles[0].endsWith(SAMPLE_FILE_SMALL), `Expected ${SAMPLE_FILE_SMALL}, got ${lintedFiles[0]}`);
        checkCodeNarcCallsCounter(1);
    });

    it("(API:file) should accept a comma-separated list of --files patterns", async function () {
        const linter = await new NpmGroovyLint(
            [process.execPath, "", "--path", "lib/example", "--files", `**/${SAMPLE_FILE_SMALL},**/${SAMPLE_FILE_WITH_SPACES}`, "--no-insight"],
            {},
        ).run();
        const lintedFiles = Object.keys(linter.lintResult.files);
        assert(lintedFiles.length === 2, `Expected 2 linted files, got ${JSON.stringify(lintedFiles)}`);
        checkCodeNarcCallsCounter(1);
    });

    it("(API:file) should report zero violations when no file matches", async function () {
        // The partitioner does not invoke CodeNarc when there is nothing to analyse, so the
        // merged report has to carry the `codeNarc` and `rules` blocks on its own: without them
        // a typo'd --files pattern failed the run with "Unable to use CodeNarc JSON result"
        const linter = await new NpmGroovyLint(
            [process.execPath, "", "--path", "lib/example", "--files", "**/*.nonexistent", "--no-insight"],
            {},
        ).run();
        assert(linter.status === 0, `Linter status is 0 (${linter.status} returned)`);
        assert(linter.lintResult.error === undefined, `Expected no error, got ${JSON.stringify(linter.lintResult.error)}`);
        assert(linter.lintResult.summary.totalFilesLinted === 0, `Expected 0 file linted got ${linter.lintResult.summary.totalFilesLinted}`);
        assert(linter.lintResult.summary.totalFoundNumber === 0, `Expected 0 violations got ${linter.lintResult.summary.totalFoundNumber}`);
    });

    it("(API:file) should run on a directory", async function () {
        const linter = await new NpmGroovyLint([process.execPath, "", "--verbose", EXAMPLE_DIRECTORY], {
            verbose: true,
        }).run();
        assert(linter.status === 1, `Linter status is 1 (${linter.status} returned)`);
        assert(linter.outputString.includes("warning"), "Output string contains warning");
        assert(Object.keys(linter.lintResult.files).length === 12, `Expected 2 files got ${Object.keys(linter.lintResult.files).length}`);
        assert(linter.lintResult.summary.totalFoundErrorNumber === 12, `Expected 12 errors to ${linter.lintResult.summary.totalFoundErrorNumber}`);
        // Snapshot of what the default preset reports on the example folder. It dropped from
        // 331/1260 when `recommended` stopped reporting style and layout.
        assert(linter.lintResult.summary.totalFoundWarningNumber === 11, `Expected 11 warnings got ${linter.lintResult.summary.totalFoundWarningNumber}`);
        assert(linter.lintResult.summary.totalFoundInfoNumber === 9, `Expected 9 infos got ${linter.lintResult.summary.totalFoundInfoNumber}`);
        checkCodeNarcCallsCounter(1);
    });
});
