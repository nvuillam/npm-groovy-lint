#! /usr/bin/env node
"use strict";
const NpmGroovyLint = require("../lib/groovy-lint.js");
let assert = require("assert");
const which = require("which");
const { beforeEachTestCase, checkCodeNarcCallsCounter, SAMPLE_FILE_BIG } = require("./helpers/common");

describe("Server", function() {
    it("(API:Server) should kill running server", async () => {
        beforeEachTestCase();

        // Ensure we have a server running to kill.
        const npmGroovyLintConfig = {
            path: "./lib/example/",
            files: "**/" + SAMPLE_FILE_BIG,
            insight: false,
            failon: "none",
            output: "none"
        };

        const oldLinter = await new NpmGroovyLint(npmGroovyLintConfig, {}).run();
        assert(oldLinter.status === 0, `Linter status is 0 (${oldLinter.status} returned)`);

        const linter = await new NpmGroovyLint([process.execPath, "", "--killserver", "--no-insight", "--verbose"], {
            verbose: true
        }).run();

        assert(linter.status === 0, `Linter status is 0 (${linter.status} returned)`);
        assert(linter.outputString.includes("CodeNarcServer terminated"), "CodeNarcServer has been terminated");
        checkCodeNarcCallsCounter(2);
    });

    it("(API:Server) should not succeed to kill running server", async () => {
        beforeEachTestCase();
        const linter = await new NpmGroovyLint([process.execPath, "", "--killserver", "--no-insight", "--verbose"], {
            verbose: true
        }).run();
        assert(linter.status === 0, `Linter status is 0 (${linter.status} returned)`);
        assert(linter.outputString.includes("CodeNarcServer was not running"), "CodeNarcServer not killed because not running");
        checkCodeNarcCallsCounter(1);
    });

    it("(API:Server) should kill java override running server", async () => {
        let javaPath;
        try {
            javaPath = which.sync("java");
        } catch (e) {
            console.log(`Java not found: ignore test method: ${e}`);
        }

        if (!javaPath) {
            this.skip();
            return;
        }

        if (javaPath.includes(" ")) {
            console.log("Skip test because of spaces in java path");
            this.skip();
            return;
        }

        if (javaPath.includes("hostedtoolcache") || javaPath.includes("/opt/java/openjdk/bin/java")) {
            console.log("Skip test because for some strange reason it provokes a timeout on CI Windows and openjdk servers");
            this.skip();
            return;
        }

        beforeEachTestCase();

        // Ensure we have a server running to kill.
        const npmGroovyLintConfig = {
            path: "./lib/example/",
            files: "**/" + SAMPLE_FILE_BIG,
            insight: false,
            failon: "none",
            output: "none"
        };
        const oldLinter = await new NpmGroovyLint(npmGroovyLintConfig, {}).run();
        assert(oldLinter.status === 0, `Linter status is 0 (${oldLinter.status} returned)`);

        const linter = await new NpmGroovyLint([process.execPath, "", "--killserver", "--no-insight", "--verbose"], {
            verbose: true
        }).run();

        assert(linter.status === 0, `Linter status is 0 (${linter.status} returned)`);
        assert(linter.outputString.includes("CodeNarcServer terminated"), "CodeNarcServer has been terminated");
        checkCodeNarcCallsCounter(2);
    });
});
