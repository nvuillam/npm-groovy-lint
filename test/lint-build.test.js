#! /usr/bin/env node
"use strict";
const util = require("util");
const c = require("ansi-colors");
let assert = require("assert");
const fse = require("fs-extra");
const path = require("path");
const childProcess = require("child_process");
const exec = util.promisify(childProcess.exec);
const spawn = childProcess.spawnSync;

const { SAMPLE_FILE_SMALL, NPM_GROOVY_LINT, SAMPLE_FILE_BIG } = require("./helpers/common");

describe("Lint with executable", () => {
    it("(EXE:file) should generate text console output", async () => {
        const params = ["--path", '"lib/example"', "--files", "**/" + SAMPLE_FILE_SMALL, "--loglevel", "warning", "--no-insight",
            "--failon", "none", "--verbose"];
        const { stdout, stderr } = await exec(NPM_GROOVY_LINT + params.join(" "));
        if (stderr) {
            console.error(stderr);
        }
        assert(stdout, "stdout is set");
        assert(stdout.includes("warning"), 'stdout should contain word "warning"');
    });
    it("(EXE:file) should generate json console output", async () => {
        const params = ["--path", '"lib/example"', "--files", "**/" + SAMPLE_FILE_SMALL, "--no-insight", "--failon", "none", "--output", "json"];
        const { stdout, stderr } = await exec(NPM_GROOVY_LINT + params.join(" "));
        if (stderr) {
            console.error(stderr);
        }
        assert(stdout, "stdout is set");
        assert(stdout.includes(`"totalFoundWarningNumber":`), "Property totalFoundWarningNumber is in result");
    });

    it("(EXE:file) should generate SARIF console output", async () => {
        const params = ["--path", '"lib/example"', "--files", "**/" + SAMPLE_FILE_SMALL, "--no-insight", "--failon", "none", "--output", "sarif"];
        const { stdout, stderr } = await exec(NPM_GROOVY_LINT + params.join(" "));
        if (stderr) {
            console.error(stderr);
        }
        assert(stdout, "stdout is set");
        const sarifLog = JSON.parse(stdout);
        assert(sarifLog.runs, "SARIF has runs");
    });

    it("(EXE:file) should lint a single file", async () => {
        const params = [
            "--loglevel", "warning",
            "--failon", "none",
            "--verbose",
            'lib/example/' + SAMPLE_FILE_SMALL];
        const { stdout, stderr } = await exec(NPM_GROOVY_LINT + params.join(" "));
        if (stderr) {
            console.error(stderr);
        }
        assert(stdout, "stdout is set");
        assert(stdout.includes("warning"), 'stdout should contain word "warning"');
        assert(
            stdout.includes(`npm-groovy-lint results in ${c.bold(1)} linted files`),
            `Wrong Number of linted files is displayed in summary: (1 expected)`
        );
    });

    it("(EXE:file) should lint 2 files", async () => {
        const params = [
            "--loglevel", "warning",
            "--failon", "none",
            "--verbose",
            'lib/example/' + SAMPLE_FILE_SMALL,
            'lib/example/' + SAMPLE_FILE_BIG
        ];
        const { stdout, stderr } = await exec(NPM_GROOVY_LINT + params.join(" "));
        if (stderr) {
            console.error(stderr);
        }
        assert(stdout, "stdout is set");
        assert(stdout.includes("warning"), 'stdout should contain word "warning"');
        assert(
            stdout.includes(`npm-groovy-lint results in ${c.bold(2)} linted files`),
            `Wrong Number of linted files is displayed in summary: (2 expected)`
        );
    });

    it("(EXE:file) should generate sarif output", async () => {
        const params = [
            "--failon", "info",
            "--output", "sarif",
            "--verbose",
            'lib/example/' + SAMPLE_FILE_SMALL,
            'lib/example/' + SAMPLE_FILE_BIG
        ];
        let hasError = true;
        try {
            await exec(NPM_GROOVY_LINT + params.join(" "));
            hasError = false;
        } catch (e) {
            if (e.stderr) {
                console.error(e.stderr);
            }
            assert(e.stdout, "stdout is set");
            const sarif = JSON.parse(e.stdout);
            assert(sarif.runs[0].results.length > 0, "There should be results in SARIF");
            assert(sarif.runs[0].artifacts.length == 2, "There should be 2 files in SARIF results");
        }
        assert(hasError === true, "There should have been an error with failon = info");
    });

    it("(EXE:file) should lint a directory", async () => {
        const params = [
            "--loglevel", "warning",
            "--failon", "none",
            "--verbose",
            'lib/example'
        ];
        const { stdout, stderr } = await exec(NPM_GROOVY_LINT + params.join(" "));
        if (stderr) {
            console.error(stderr);
        }
        assert(stdout, "stdout is set");
        assert(stdout.includes("warning"), 'stdout should contain word "warning"');
        assert(
            stdout.includes(`npm-groovy-lint results in ${c.bold(12)} linted files`),
            `Wrong Number of linted files is displayed in summary: (12 expected)`
        );
    });

    it("(EXE:file) should ignore fake_node_modules pattern", async () => {
        const params = ["--ignorepattern", "**/fake_node_modules/**", "--failon", "none", "--no-insight", "--output", "txt"];
        const { stdout, stderr } = await exec("cd ./lib/example && " + NPM_GROOVY_LINT + params.join(" "));
        if (stderr) {
            console.error(stderr);
        }
        assert(stdout, "stdout is set");
        assert(!stdout.includes(`ToIgnore.groovy`), `ToIgnore.groovy has been ignored \n${stdout}`);
        assert(
            stdout.includes(`npm-groovy-lint results in ${c.bold(11)} linted files`),
            `Number of linted files is displayed in summary \n${stdout}`
        );
    });

    // Tmp disable
    /* it("(EXE:file) should ignore fake_node_modules pattern with --noserver", async () => {
        const params = ["--ignorepattern", "**//*fake_node_modules/**", "--failon", "none", "--no-insight", "--output", "txt", "--noserver"];
        const { stdout, stderr } = await exec("cd ./lib/example && " + NPM_GROOVY_LINT + params.join(" "));
        if (stderr) {
            console.error(stderr);
        }
        assert(stdout, "stdout is set");
        assert(!stdout.includes(`ToIgnore.groovy`), `ToIgnore.groovy has been ignored \n${stdout}`);
        assert(
            stdout.includes(`npm-groovy-lint results in ${c.bold(11)} linted files`),
            `Number of linted files is displayed in summary \n${stdout}`
        );
    }); */

    it("(EXE:file) should generate codenarc HTML file report", async () => {
        const reportFileName = path.resolve("ReportTestCodenarc.html");
        const params = [
            "--codenarcargs",
            '-basedir="lib/example"',
            '-title="TestTitleCodenarc"',
            "-maxPriority1Violations=0",
            `-report="html:${reportFileName}"`
        ];
        await exec(NPM_GROOVY_LINT + params.join(" "));
        assert(fse.existsSync(reportFileName), "html CodeNarc report has been generated at " + reportFileName);
        fse.removeSync(reportFileName);
    });

    it("(EXE:file) should generate codenarc XML file report", async () => {
        const reportFileName = path.resolve("ReportTestCodenarc.xml");
        const params = [
            "--codenarcargs",
            '-basedir="lib/example"',
            '-title="TestTitleCodenarc"',
            "-maxPriority1Violations=0",
            `-report="xml:${reportFileName}"`
        ];
        await exec(NPM_GROOVY_LINT + params.join(" "));
        assert(fse.existsSync(reportFileName), "xml CodeNarc report has been generated at " + reportFileName);
        fse.removeSync(reportFileName);
    });

    it("(EXE:file) should run on a Jenkinsfile", async () => {
        const params = ["--path", ' "lib/example"', "--files", "**/Jenkinsfile", "-c", "recommended-jenkinsfile","--failon", "none", "--no-insight", "--verbose"];
        const { stdout, stderr } = await exec(NPM_GROOVY_LINT + params.join(" "));
        if (stderr) {
            console.error(stderr);
        }
        assert(stdout, "stdout is set");
        assert(stdout.includes("warning"), 'stdout should contain word "warning"');
    });

    it("(EXE:help) should show npm-groovy-lint help", async () => {
        const params = ["-h"];
        const { stdout, stderr } = await exec(NPM_GROOVY_LINT + params.join(" "));
        if (stderr) {
            console.error(stderr);
        }
        assert(stdout, "stdout is set");
        assert(stdout.includes("--verbose"), 'stdout should contain word "--verbose"');
    });

    it("(EXE:help) should show npm-groovy-lint version", async () => {
        const params = ["-v"];
        const { stdout, stderr } = await exec(NPM_GROOVY_LINT + params.join(" "));
        if (stderr) {
            console.error(stderr);
        }
        assert(stdout, "stdout is set");
        assert(stdout.includes("npm-groovy-lint v"), "Version is returned");
    });

    it("(EXE:help) should show codenarc help", async () => {
        const params = ["--codenarcargs", "-help"];
        const { stdout, stderr } = await exec(NPM_GROOVY_LINT + params.join(" "));
        if (stderr) {
            console.error(stderr);
        }
        assert(stdout, "stdout is set");
        assert(
            stdout.includes("where OPTIONS are zero or more command-line options"),
            'stdout should contain word "where OPTIONS are zero or more command-line options"'
        );
    });

    it("(EXE:file) failonerror", async () => {
        const params = ["--path", '"lib/example"', "--files", "**/" + SAMPLE_FILE_SMALL, "--failonerror", "--no-insight", "--output", "txt"];
        const { stderr, status } = spawn(NPM_GROOVY_LINT + params.join(" "), [], { shell: true });
        if (stderr) {
            console.error(stderr.toString());
        }
        assert(status === 1, `Status code is 1 (returned: ${status})`);
    });

    it("(EXE:file) failonwarning", async () => {
        const params = ["--path", '"lib/example"', "--files", "**/" + SAMPLE_FILE_SMALL, "--failonwarning", "--no-insight", "--output", "txt"];
        const { stderr, status } = spawn(NPM_GROOVY_LINT + params.join(" "), [], { shell: true });
        if (stderr) {
            console.error(stderr.toString());
        }
        assert(status === 1, `Status code is 1 (returned: ${status})`);
    });

    it("(EXE:file) failoninfo", async () => {
        const params = ["--path", '"lib/example"', "--files", "**/" + SAMPLE_FILE_SMALL, "--failoninfo", "--no-insight", "--output", "txt"];
        const { stderr, status } = spawn(NPM_GROOVY_LINT + params.join(" "), [], { shell: true });
        if (stderr) {
            console.error(stderr.toString());
        }
        assert(status === 1, `Status code is 1 (returned: ${status})`);
    });

    it("(EXE:file) failon info", async () => {
        const params = ["--path", '"lib/example"', "--files", "**/" + SAMPLE_FILE_SMALL, "--failon", "info", "--no-insight", "--output", "txt"];
        const { stderr, status } = spawn(NPM_GROOVY_LINT + params.join(" "), [], { shell: true });
        if (stderr) {
            console.error(stderr.toString());
        }
        assert(status === 1, `Status code is 1 (returned: ${status})`);
    });

    it("(EXE:file) Send anonymous usage stats", async () => {
        const params = ["--path", '"lib/example"', "--files", "**/" + SAMPLE_FILE_SMALL, "--output", "txt","--failon", "none"];
        const { stdout, stderr, status } = spawn(NPM_GROOVY_LINT + params.join(" "), [], { shell: true });
        if (stdout) {
            console.log("STDOUT:\n");
            console.log(stdout.toString());
        }
        if (stderr) {
            console.log("STDERR:\n");
            console.error(stderr.toString());
        }
        assert(status === 0, `Status code is 0 (returned: ${status})`);
    });
});
