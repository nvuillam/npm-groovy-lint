#! /usr/bin/env node
"use strict";
const NpmGroovyLint = require("../groovy-lint.js");
let assert = require("assert");
const fse = require("fs-extra");
const os = require("os");
const path = require("path");
const which = require("which");
const { beforeEachTestCase, checkCodeNarcCallsCounter, SAMPLE_FILE_BIG, SAMPLE_FILE_SMALL, SAMPLE_FILE_SMALL_PATH } = require("./helpers/common");

describe("Miscellaneous", function() {
    beforeEach(beforeEachTestCase);

    it("(API:source) returns config file using path", async () => {
        const npmGroovyLintConfig = {
            path: "./lib/example/",
            files: "**/" + SAMPLE_FILE_SMALL,
            output: "txt",
            insight: false,
            verbose: true
        };
        const linter = await new NpmGroovyLint(npmGroovyLintConfig, {}).run();
        const filePath = await linter.getConfigFilePath();
        assert(linter.status === 0, `Linter status is 0 (${linter.status} returned)`);
        assert(path.resolve(filePath) === path.resolve("./lib/example/.groovylintrc.json"), ".groovylintrc.json has been returned");
    });

    it("(API:source) returns config file path using parameter", async () => {
        const npmGroovyLintConfig = {};
        const linter = new NpmGroovyLint(npmGroovyLintConfig, {});
        const filePath = await linter.getConfigFilePath("./lib/example");
        assert(linter.status === 0, `Linter status is 0 (${linter.status} returned)`);
        assert(path.resolve(filePath) === path.resolve("./lib/example/.groovylintrc.json"), ".groovylintrc.json has been returned");
    });

    it("(API:source) load config using specific file name", async () => {
        const customConfigFilePath = process.platform.includes("linux") ? "~/.groovylintrc-custom.json" : os.tmpdir() + "\\.groovylintrc-custom.json";
        await fse.ensureDir("~/", { mode: "0777" });
        await fse.copy("./lib/example/.groovylintrc-custom.json", customConfigFilePath);
        const npmGroovyLintConfig = {
            config: customConfigFilePath,
            path: "./lib/example/",
            files: "**/" + SAMPLE_FILE_SMALL,
            output: "txt",
            insight: false,
            verbose: true
        };
        const linter = await new NpmGroovyLint(npmGroovyLintConfig, {}).run();
        await fse.remove(customConfigFilePath);
        const rules = linter.options.rules || {};
        assert(rules["CompileStatic"] == "off", "CompileStatic is off");
        assert(rules["CouldBeElvis"] == "off", "CouldBeElvis is off");
        assert(rules["NoDef"] == "off", "NoDef is off");
        assert(rules["Indentation"]["spacesPerIndentLevel"] === 2, "Indentation rule override has been taken in account");
        assert(linter.status === 0, `Linter status is 0 (${linter.status} returned)`);
    });

    it("(API:source) load standard config using string key", async () => {
        const npmGroovyLintConfig = {
            config: "recommended-jenkinsfile",
            path: "./lib/example/",
            files: "**/" + SAMPLE_FILE_SMALL,
            insight: false,
            output: "txt",
            verbose: true
        };
        const linter = await new NpmGroovyLint(npmGroovyLintConfig, {}).run();
        const rules = linter.options.rules || {};
        assert(
            rules["UnusedVariable"] && rules["UnusedVariable"]["ignoreVariableNames"] == "_",
            `UnusedVariable.ignoreVariableNames = '_' not found `
        );
        assert(rules["NoDef"] == "off", "NoDef is off");
        assert(rules["VariableName"] == "off", "VariableName is off");
        assert(rules["CompileStatic"] == "off", "CompileStatic is off");
        assert(linter.status === 0, `Linter status is 0 (${linter.status} returned)`);
    });

    it("(API:source) load custom config using string key", async () => {
        const npmGroovyLintConfig = {
            config: "custom-jenkinsfile",
            path: "./lib/example/",
            files: "**/" + SAMPLE_FILE_SMALL,
            output: "txt",
            insight: false,
            verbose: true
        };
        const linter = await new NpmGroovyLint(npmGroovyLintConfig, {}).run();
        const rules = linter.options.rules || {};
        assert(
            rules["UnusedVariable"] && rules["UnusedVariable"]["ignoreVariableNames"] == "_",
            `UnusedVariable.ignoreVariableNames = '_' not found `
        );
        assert(rules["NoDef"] == "off", "NoDef is off");
        assert(rules["VariableName"] && rules["VariableName"]["severity"] === "info", "VariableName is severity info");
        assert(rules["CompileStatic"] == "off", "CompileStatic is off");
        assert(rules["CouldBeSwitchStatement"] == "off", "CouldBeSwitchStatement is off");
        assert(rules["CouldBeElvis"] == "off", "CouldBeElvis is off");
        assert(linter.status === 0, `Linter status is 0 (${linter.status} returned)`);
    });

    it("(API:source) return indent length without linting", async () => {
        let indentLength = null;
        const linter = new NpmGroovyLint(
            {
                sourcefilepath: SAMPLE_FILE_SMALL_PATH,
                insight: false,
                output: "none"
            },
            {}
        );
        const tmpStartPath = path.dirname(SAMPLE_FILE_SMALL_PATH);
        let tmpConfigFilePath = await linter.getConfigFilePath(tmpStartPath);
        if (tmpConfigFilePath) {
            const configUser = await linter.loadConfig(tmpConfigFilePath, "format");
            if (configUser.rules && configUser.rules["Indentation"] && configUser.rules["Indentation"]["spacesPerIndentLevel"]) {
                indentLength = configUser.rules["Indentation"]["spacesPerIndentLevel"];
            }
        }
        assert(indentLength != null && indentLength > 0, "Indent length has been returned");
    });

    it("(API:source) return rules", async () => {
        const npmGroovyLintConfig = {
            path: "./lib/example/",
            files: "**/" + SAMPLE_FILE_SMALL,
            returnrules: true,
            insight: false,
            output: "none"
        };
        const linter = await new NpmGroovyLint(npmGroovyLintConfig, {}).run();
        assert(linter.status === 0, `Linter status is 0 (${linter.status} returned)`);
        assert(linter.lintResult.rules != null, "Rules are returned ");
        assert(linter.lintResult.rules["AssertWithinFinallyBlock"].docUrl != null, "Rules doc urls are returned ");
    });

    it("(API:source) do not return rules", async () => {
        const npmGroovyLintConfig = {
            path: "./lib/example/",
            files: "**/" + SAMPLE_FILE_SMALL,
            insight: false,
            output: "none"
        };
        const linter = await new NpmGroovyLint(npmGroovyLintConfig, {}).run();
        assert(linter.status === 0, `Linter status is 0 (${linter.status} returned)`);
        assert(linter.lintResult.rules == null, "Rules are not returned");
    });

    it("(API:source) send anonymous usage statistics", async () => {
        const npmGroovyLintConfig = {
            path: "./lib/example/",
            files: "**/" + SAMPLE_FILE_SMALL,
            returnrules: true,
            output: "txt"
        };
        const linter = await new NpmGroovyLint(npmGroovyLintConfig, {}).run();
        assert(linter.status === 0, `Linter status is 0 (${linter.status} returned)`);
        assert(linter.startElapse != null, "Anonymous stats has not been sent");
    });

    it("(API:source) should use a CodeNarc ruleset defined in groovylintrc.json", async () => {
        const npmGroovyLintConfig = {
            config: "./lib/example/.groovylintrc-codenarc-rulesets.json",
            path: "./lib/example/",
            files: "**/" + SAMPLE_FILE_SMALL,
            output: "txt"
        };
        const linter = await new NpmGroovyLint(npmGroovyLintConfig, {}).run();
        assert(linter.status === 0, `Linter status is 0 (${linter.status} returned)`);
    });

    it("(API:source) should cancel current request", async () => {
        const requestKey = "requestKeyCalculatedByExternal" + Math.random();
        const delay = os.platform() === "win32" ? 500 : 300;
        const npmGroovyLintConfig = {
            path: "./lib/example/",
            files: "**/" + SAMPLE_FILE_BIG,
            insight: false,
            output: "none"
        };
        const linterProms = [];
        const linter1 = new NpmGroovyLint(npmGroovyLintConfig, {
            requestKey: requestKey
        });
        linterProms.push(linter1.run());
        await sleepPromise(delay);
        const linter2 = new NpmGroovyLint(npmGroovyLintConfig, {
            requestKey: requestKey
        });
        linterProms.push(linter2.run());
        await sleepPromise(delay);
        const linter3 = new NpmGroovyLint(npmGroovyLintConfig, {
            requestKey: requestKey
        });
        linterProms.push(linter3.run());
        await sleepPromise(delay);
        const linter4 = new NpmGroovyLint(npmGroovyLintConfig, {
            requestKey: requestKey
        });
        linterProms.push(linter4.run());
        await sleepPromise(delay);
        const linter5 = new NpmGroovyLint(npmGroovyLintConfig, {
            requestKey: requestKey
        });
        linterProms.push(linter5.run());
        await sleepPromise(delay);
        const linter6 = new NpmGroovyLint(npmGroovyLintConfig, {
            requestKey: requestKey
        });
        linterProms.push(linter6.run());
        await sleepPromise(delay);

        const linterLast = new NpmGroovyLint(npmGroovyLintConfig, {
            requestKey: requestKey
        });
        await linterLast.run();

        assert([0, 9].includes(linter1.status), `Linter 1 status is 9 or 0 (returned ${linter1.status}`);
        assert([0, 9].includes(linter2.status), `Linter 2 status is 9 or 0 (returned ${linter2.status}`);
        assert([0, 9].includes(linter3.status), `Linter 3 status is 9 or 0 (returned ${linter3.status}`);
        assert([0, 9].includes(linter4.status), `Linter 4 status is 9 or 0 (returned ${linter4.status}`);
        assert([0, 9].includes(linter5.status), `Linter 5 status is 9 or 0 (returned ${linter5.status}`);
        assert([0, 9].includes(linter6.status), `Linter 6 status is 9 or 0 (returned ${linter6.status}`);
        assert([0].includes(linterLast.status), `LinterLast status = 0 (returned ${linterLast.status}`);
        assert(
            [linter1.status, linter2.status, linter3.status, linter4.status, linter5.status, linter6.status].includes(9),
            `at least one response code is 9`
        );
        await Promise.all(linterProms);
    });

    it("(API:help) should show npm-groovy-lint help", async () => {
        const linter = await new NpmGroovyLint([process.execPath, "", "-h"], {}).run();
        assert(linter.status === 0, `Linter status is 0 (${linter.status} returned)`);
        assert(linter.outputString.includes("--verbose"), "--verbose is found in output text");
    });

    it("(API:help) should show npm-groovy-lint help option", async () => {
        const linter = await new NpmGroovyLint([process.execPath, "", "-h", "source"], {}).run();
        assert(linter.status === 0, `Linter status is 0 (${linter.status} returned)`);
        assert(linter.outputString.includes("-s, --source"), "npm-groovy-lint Help is displayed");
    });

    it("(API:help) should show npm-groovy-lint version", async () => {
        process.env.npm_package_version = ""; // NV: Do nto use npm_package_version to have more code coverage :)
        const linter = await new NpmGroovyLint([process.execPath, "", "-v"], {}).run();
        assert(linter.status === 0, `Linter status is 0 (${linter.status} returned)`);
        const FindPackageJson = require("find-package-json");
        const finder = FindPackageJson(__dirname);
        const v = finder.next().value.version;
        assert(linter.outputString.includes(`npm-groovy-lint version ${v}`), `Provides version ${v}\nReturned outputString:\n${linter.outputString}`);
        assert(linter.outputString.includes(`CodeNarc version`), `Provides CodeNarc version\nReturned outputString:\n${linter.outputString}`);
        assert(linter.outputString.includes(`Groovy version`), `Provides CodeNarc version\nReturned outputString:\n${linter.outputString}`);
    });

    it("(API:help) should show codenarc help", async () => {
        const linter = await new NpmGroovyLint([process.execPath, "", "--codenarcargs", "-help"], {}).run();
        assert(linter.status === 0, `Linter status is 0 (${linter.status} returned)`);
        assert(linter.codeNarcStdOut.includes("where OPTIONS are zero or more command-line options"), "CodeNarc help is displayed");
        checkCodeNarcCallsCounter(1);
    });

    it("(API:Server) should kill running server", async () => {
        const linter = await new NpmGroovyLint([process.execPath, "", "--killserver", "--no-insight", "--verbose"], {
            verbose: true
        }).run();

        assert(linter.status === 0, `Linter status is 0 (${linter.status} returned)`);
        assert(linter.outputString.includes("CodeNarcServer terminated"), "CodeNarcServer has been terminated");
        checkCodeNarcCallsCounter(1);
    });

    it("(API:Server) should not succeed to kill running server", async () => {
        const linter = await new NpmGroovyLint([process.execPath, "", "--killserver", "--no-insight", "--verbose"], {
            verbose: true
        }).run();
        assert(linter.status === 0, `Linter status is 0 (${linter.status} returned)`);
        assert(linter.outputString.includes("CodeNarcServer was not running"), "CodeNarcServer not killed because not running");
        checkCodeNarcCallsCounter(1);
    });

    it("(API:source) override java executable", async () => {
        let javaPath;
        try {
            javaPath = which.sync("java");
        } catch (e) {
            console.log("Java not found: ignore test method");
        }
        if (javaPath) {
            console.log(`Java found: ${javaPath}`);
            const javaExec = javaPath;
            const javaOptions = "-Xms512m,-Xmx2g";
            const npmGroovyLintConfig = {
                path: "./lib/example/",
                files: "**/" + SAMPLE_FILE_SMALL,
                insight: false,
                javaexecutable: javaExec,
                javaoptions: javaOptions,
                output: "none"
            };
            const linter = await new NpmGroovyLint(npmGroovyLintConfig, {}).run();
            assert(linter.status === 0, `Linter status is 0 (${linter.status} returned)`);
        }
    }).timeout(120000);

    it("(API:Server) should kill java override running server", async () => {
        let javaPath;
        try {
            javaPath = which.sync("java");
        } catch (e) {
            console.log("Java not found: ignore test method");
        }
        if (javaPath) {
            const linter = await new NpmGroovyLint([process.execPath, "", "--killserver", "--no-insight", "--verbose"], {
                verbose: true
            }).run();

            assert(linter.status === 0, `Linter status is 0 (${linter.status} returned)`);
            assert(linter.outputString.includes("CodeNarcServer terminated"), "CodeNarcServer has been terminated");
            checkCodeNarcCallsCounter(1);
        }
    });
});

function sleepPromise(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
