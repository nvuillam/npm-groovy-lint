#! /usr/bin/env node
const NpmGroovyLint = require("../lib/groovy-lint.js");
let assert = require("assert");
import * as fs from "fs-extra";
const { SAMPLE_FILE_SMALL_PATH } = require("./helpers/common");

describe("Errors", function() {
    it("(API:source) should trigger a parse options error", async function() {
        const prevFileContent = fs.readFileSync("./lib/example/SampleFile.groovy").toString();
        const npmGroovyLintConfig = {
            source: prevFileContent,
            someUnknownParam: "lelamanul"
        };
        const linter = await new NpmGroovyLint(npmGroovyLintConfig, {}).run();

        assert(linter.status === 2, `Linter status is 2 (${linter.status} returned)`);
        assert(linter.error.msg.includes("Invalid option"), "Invalid option detected");
    });

    it("(API:source) should trigger a loglevel failon consistency error", async function() {
        const prevFileContent = fs.readFileSync("./lib/example/SampleFile.groovy").toString();
        const npmGroovyLintConfig = {
            source: prevFileContent,
            failon: "warning",
            loglevel: "error"
        };
        const linter = await new NpmGroovyLint(npmGroovyLintConfig, {}).run();

        assert(linter.status === 2, `Linter status is 2 (${linter.status} returned)`);
        assert(linter.error.msg.includes("failon option"), "failon + loglevel options consistency error detected");
    });

    it("(API:source) should trigger a codenarc error", async function() {
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

    it("(API:source) should trigger a codenarc error (--noserver)", async function() {
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

    it("(API:source) should trigger a fix function error", async function() {
        const prevFileContent = fs.readFileSync(SAMPLE_FILE_SMALL_PATH).toString();
        const npmGroovyLintConfig = {
            source: prevFileContent,
            fix: true,
            fixrules: "TriggerTestError",
            insight: false,
            output: "txt",
            verbose: true
        };
        const linter = await new NpmGroovyLint(npmGroovyLintConfig, {}).run();

        assert(linter.status === 1, `Linter status is 1 (${linter.status} returned)`);
    });

    it("(API:source) should detect and display a parse error", async function() {
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
