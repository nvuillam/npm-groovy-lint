#! /usr/bin/env node
let assert = require('assert');
const os = require("os");
const fse = require("fs-extra");
const jsdiff = require("diff");

const NPM_GROOVY_LINT = 'npm-groovy-lint ';
const startPath = './lib/example/';
const SAMPLE_FILE_BIG = 'SampleFile.groovy';
const SAMPLE_FILE_BIG_PATH = startPath + SAMPLE_FILE_BIG;
const SAMPLE_FILE_SMALL = 'SampleFileSmall.groovy';
const SAMPLE_FILE_SMALL_PATH = startPath + SAMPLE_FILE_SMALL;

// Reset codeNarcCallsCounter before each test
const beforeEachTestCase = function () {
    globalThis.codeNarcCallsCounter = 0;
    globalThis.codeNarcCalls = [];
}

// Check counter of calls to CodeNarc
const checkCodeNarcCallsCounter = (expectedNb) => {
    assert(expectedNb === globalThis.codeNarcCallsCounter, `Number of calls to codeNarc is wrong: ${expectedNb} expected but ${globalThis.codeNarcCallsCounter} returned.\nCodeNarc calls: \n${JSON.stringify(globalThis.codeNarcCalls, null, 2)}`)
}

// Copy files in temp directory to not update the package files
async function copyFilesInTmpDir() {
    const osTypeLower = os.type().toLowerCase();
    const rootTmpDir =
        (osTypeLower.includes('linux') || osTypeLower.includes('darwin')) ? // Linux or mac
            './jdeploy-bundle/tmptest' :
            os.tmpdir(); // Windows / other
    const tmpDir = rootTmpDir + '/' + ('tmpGroovyLintTest_' + Math.random()).replace('.', '');
    await fse.ensureDir(tmpDir, { mode: '0777' });
    await fse.copy('./jdeploy-bundle/lib/example', tmpDir);
    console.info('GroovyLint: Copied ./jdeploy-bundle/lib/example into ' + tmpDir);
    return tmpDir;
}

// Get diff between 2 strings
function getDiff(expected, afterUpdate, beforeUpdate) {
    const diff = jsdiff.diffChars(expected, afterUpdate);
    const effectiveDiffs = diff.filter((item => (item.added || item.removed) && ![`\r`, `\r\n`].includes(item.value)));
    if (effectiveDiffs.length > 0) {
        console.error('BeforeFix: \n' + beforeUpdate);
        console.error('AfterFix: \n' + afterUpdate);
        console.error('Expected: \n' + expected);
    } else {
        console.info('BeforeFix: \n' + beforeUpdate);
        console.info('Verified: \n' + afterUpdate);
    }
    return effectiveDiffs;
}

module.exports = {
    NPM_GROOVY_LINT,
    SAMPLE_FILE_BIG,
    SAMPLE_FILE_SMALL,
    SAMPLE_FILE_BIG_PATH,
    SAMPLE_FILE_SMALL_PATH,
    beforeEachTestCase,
    checkCodeNarcCallsCounter,
    copyFilesInTmpDir,
    getDiff
}