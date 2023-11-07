#! /usr/bin/env node
let assert = require("assert");
const os = require("os");
const fse = require("fs-extra");
const jsdiff = require("diff");

const NPM_GROOVY_LINT = "npm-groovy-lint ";
const EXAMPLE_DIRECTORY = "./lib/example/";
const SAMPLE_FILE_BIG = "SampleFile.groovy";
const SAMPLE_FILE_BIG_PATH = EXAMPLE_DIRECTORY + SAMPLE_FILE_BIG;
const SAMPLE_FILE_SMALL = "SampleFileSmall.groovy";
const SAMPLE_FILE_SMALL_FORMAT = "SampleFileSmallFormatted.txt";
const SAMPLE_FILE_SMALL_FIX = "SampleFileSmallFixed.txt";
const SAMPLE_FILE_SMALL_PATH = EXAMPLE_DIRECTORY + SAMPLE_FILE_SMALL;
const SAMPLE_FILE_PARSE_ERROR = "WithParseError.groovy";
const SAMPLE_FILE_PARSE_ERROR_PATH = EXAMPLE_DIRECTORY + SAMPLE_FILE_PARSE_ERROR;
const SAMPLE_FILE_WITH_SPACES = "file with spaces.groovy";
const SAMPLE_FILE_WITH_SPACES_PATH = EXAMPLE_DIRECTORY + SAMPLE_FILE_WITH_SPACES;
const SAMPLE_RULESET_1 = "RuleSet-1.groovy";
const SAMPLE_RULESET_1_PATH = EXAMPLE_DIRECTORY + SAMPLE_RULESET_1;
const SAMPLE_RULESET_2 = "RuleSet-2.groovy";
const SAMPLE_RULESET_2_PATH = EXAMPLE_DIRECTORY + SAMPLE_RULESET_2;

// Reset codeNarcCallsCounter before each test
const beforeEachTestCase = function() {
    globalThis.codeNarcCallsCounter = 0;
    globalThis.codeNarcCalls = [];
};

// Check counter of calls to CodeNarc
const checkCodeNarcCallsCounter = expectedNb => {
    assert(
        expectedNb === globalThis.codeNarcCallsCounter,
        `Number of calls to codeNarc is wrong: ${expectedNb} expected but ${
            globalThis.codeNarcCallsCounter
        } returned.\nCodeNarc calls: \n${JSON.stringify(globalThis.codeNarcCalls, null, 2)}`
    );
};

// Copy files in temp directory to not update the package files
async function copyFilesInTmpDir() {
    const rootTmpDir =
        process.platform.includes("linux") || process.platform.includes("darwin") // Linux or mac
            ? "./tmptest"
            : os.tmpdir(); // Windows / other
    const tmpDir = rootTmpDir + "/" + ("tmpGroovyLintTest_" + Math.random()).replace(".", "");
    await fse.ensureDir(tmpDir, { mode: "0777" });
    await fse.copy("./lib/example", tmpDir);
    console.info("GroovyLint: Copied ./lib/example into " + tmpDir);
    return tmpDir;
}

// Get diff between 2 strings
function getDiff(expected, afterUpdate, beforeUpdate) {
    const diff = jsdiff.diffChars(expected, afterUpdate);
    const effectiveDiffs = diff.filter(item => item.added || item.removed);
    if (effectiveDiffs.length > 0) {
        console.error("BeforeFix: \n" + beforeUpdate);
        console.error("AfterFix: \n" + afterUpdate);
        console.error("Expected: \n" + expected);
    } else {
        console.info("BeforeFix: \n" + beforeUpdate);
        console.info("Verified: \n" + afterUpdate);
    }
    return effectiveDiffs;
}

// assert output includes expectedCount linted files result.
function assertLintedFiles(output, expectedCount) {
    const lintedResult = output.matchAll(/npm-groovy-lint results in .\[1m(\S+).\[22m linted files/g);
    assert(lintedResult, "Missing linted files result");
    const gotCount = Array.from(lintedResult, m => m[1]);
    assert(
        gotCount == expectedCount,
        `Expected ${expectedCount} linted files got ${gotCount}`
    );
}

module.exports = {
    NPM_GROOVY_LINT,
    EXAMPLE_DIRECTORY,
    SAMPLE_FILE_BIG,
    SAMPLE_FILE_SMALL,
    SAMPLE_FILE_SMALL_FORMAT,
    SAMPLE_FILE_SMALL_FIX,
    SAMPLE_FILE_BIG_PATH,
    SAMPLE_FILE_SMALL_PATH,
    SAMPLE_FILE_WITH_SPACES,
    SAMPLE_FILE_WITH_SPACES_PATH,
    SAMPLE_FILE_PARSE_ERROR,
    SAMPLE_FILE_PARSE_ERROR_PATH,
    SAMPLE_RULESET_1,
    SAMPLE_RULESET_1_PATH,
    SAMPLE_RULESET_2,
    SAMPLE_RULESET_2_PATH,
    beforeEachTestCase,
    checkCodeNarcCallsCounter,
    copyFilesInTmpDir,
    getDiff,
    assertLintedFiles
};
