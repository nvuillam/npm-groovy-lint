#! /usr/bin/env node
"use strict";
const NpmGroovyLint = require("../lib/groovy-lint.js");
let assert = require("assert");
const fse = require("fs-extra");

const { SAMPLE_FILE_SMALL_PATH } = require("./helpers/common");

describe("Errors", function() {
    it("(API:source) should trigger a parse options error", async () => {
        const prevFileContent = fse.readFileSync("./lib/example/SampleFile.groovy").toString();
        const npmGroovyLintConfig = {
            source: prevFileContent,
            someUnknownParam: "lelamanul"
        };
        const linter = await new NpmGroovyLint(npmGroovyLintConfig, {}).run();

        assert(linter.status === 2, `Linter status is 2 (${linter.status} returned)`);
        assert(linter.error.msg.includes("Invalid option"), "Invalid option detected");
    });

    it("(API:source) should trigger a loglevel failon consistency error", async () => {
        const prevFileContent = fse.readFileSync("./lib/example/SampleFile.groovy").toString();
        const npmGroovyLintConfig = {
            source: prevFileContent,
            failon: "warning",
            loglevel: "error"
        };
        const linter = await new NpmGroovyLint(npmGroovyLintConfig, {}).run();

        assert(linter.status === 2, `Linter status is 2 (${linter.status} returned)`);
        assert(linter.error.msg.includes("failon option"), "failon + loglevel options consistency error detected");
    });

    it("(API:source) should trigger a codenarc error", async () => {
        const npmGroovyLintConfig = {
            path: "/not/existing/path",
            output: "txt",
            verbose: true
        };
        const linter = await new NpmGroovyLint(npmGroovyLintConfig, {}).run();

        assert(linter.status === 2, `Linter status is 2 (${linter.status} returned)`);
        assert(
            linter.error && linter.error.msg.includes("java.io.FileNotFoundException"),
            `FileNotFoundException returned by CodeNarc (error: ${linter.error.msg})`
        );
    });

    it("(API:source) should trigger a codenarc error (--noserver)", async () => {
        const npmGroovyLintConfig = {
            path: "/not/existing/path",
            noserver: true
        };
        const linter = await new NpmGroovyLint(npmGroovyLintConfig, {}).run();

        assert(linter.status === 2, `Linter status is 2 (${linter.status} returned)`);
        assert(
            linter.error && linter.error.msg.includes("java.io.FileNotFoundException"),
            `FileNotFoundException returned by CodeNarc (error: ${linter.error.msg})`
        );
    });

    it("(API:source) should trigger a fix function error", async () => {
        const prevFileContent = fse.readFileSync(SAMPLE_FILE_SMALL_PATH).toString();
        const npmGroovyLintConfig = {
            source: prevFileContent,
            fix: true,
            fixrules: "TriggerTestError",
            insight: false,
            output: "txt",
            verbose: true
        };
        const linter = await new NpmGroovyLint(npmGroovyLintConfig, {}).run();

        assert(linter.status === 0, `Linter status is 0 (${linter.status} returned)`);
    });

    it("(API:source) should detect and display a parse error", async () => {
        const npmGroovyLintConfig = {
            failon: "error",
            path: "./lib/example/test",
            files: "**/groovy-bad.groovy",
            insight: false,
            output: "txt"
        };
        const linter = await new NpmGroovyLint(npmGroovyLintConfig, {}).run();

        assert(linter.status === 1, `Linter status is 1 (${linter.status} returned)`);
        assert(linter.outputString.includes("NglParseError"), "Parse error has been detected");
    });
});
