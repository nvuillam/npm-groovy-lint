#! /usr/bin/env node
"use strict";
const NpmGroovyLint = require('../src/groovy-lint.js');
let assert = require('assert');
const fse = require("fs-extra");
const rimraf = require("rimraf");
const { beforeEachTestCase, checkCodeNarcCallsCounter, getDiff, copyFilesInTmpDir, SAMPLE_FILE_BIG, SAMPLE_FILE_BIG_PATH } = require('./helpers/common');

describe('Format with API', function () {
    beforeEach(beforeEachTestCase);

    it('(API:source) should format code', async () => {
        const expectedFixedErrs = 1086;
        const prevFileContent = fse.readFileSync(SAMPLE_FILE_BIG_PATH).toString();
        const npmGroovyLintConfig = {
            source: prevFileContent,
            format: true,
            nolintafter: true,
            output: 'txt',
            verbose: true
        };
        const linter = await new NpmGroovyLint(
            npmGroovyLintConfig, {
            jdeployRootPath: 'jdeploy-bundle'
        }).run();

        assert(linter.status === 0, 'Status is 0');
        assert(linter.lintResult.summary.totalFixedNumber >= expectedFixedErrs, `${expectedFixedErrs} errors have been fixed (${linter.lintResult.summary.totalFixedNumber} returned)`);
        assert(linter.lintResult.files[0].updatedSource &&
            linter.lintResult.files[0].updatedSource !== prevFileContent,
            'Source has been updated');
        const fixedNbInLogs = (linter.outputString.match(/fixed/g) || []).length;
        assert(fixedNbInLogs >= expectedFixedErrs, `Result log contains ${expectedFixedErrs} fixed errors (${fixedNbInLogs} returned)`);
        assert(!linter.outputString.includes('NaN'), 'Results does not contain NaN');
        checkCodeNarcCallsCounter(2);

    }).timeout(100000);

    it('(API:file) should format code', async () => {
        const expectedFixedErrs = 1086;
        const tmpDir = await copyFilesInTmpDir();
        const prevFileContent = fse.readFileSync(SAMPLE_FILE_BIG_PATH).toString();
        const npmGroovyLintConfig = {
            path: tmpDir,
            files: `**/${SAMPLE_FILE_BIG}`,
            format: true,
            nolintafter: true,
            output: 'txt',
            verbose: true
        };
        const linter = await new NpmGroovyLint(
            npmGroovyLintConfig, {
            jdeployRootPath: 'jdeploy-bundle'
        }).run();

        assert(linter.status === 0, 'Status is 0');
        assert(linter.lintResult.summary.totalFixedNumber >= expectedFixedErrs, `${expectedFixedErrs} errors have been fixed (${linter.lintResult.summary.totalFixedNumber} returned)`);
        const newFileContent = fse.readFileSync(tmpDir + '/' + SAMPLE_FILE_BIG).toString();
        assert(newFileContent !== prevFileContent, 'File has been updated');
        rimraf.sync(tmpDir);
        const fixedNbInLogs = (linter.outputString.match(/fixed/g) || []).length;
        assert(fixedNbInLogs >= expectedFixedErrs, `Result log contains ${expectedFixedErrs} fixed errors (${fixedNbInLogs} returned)`);
        assert(!linter.outputString.includes('NaN'), 'Results does not contain NaN');
        checkCodeNarcCallsCounter(2);

        rimraf.sync(tmpDir);
    }).timeout(100000);

    for (const [key, val] of getSamplesMap()) {
        it('(API:source) custom check ' + key, async () => {
            await checkRule(key, val);
        }).timeout(30000);
    }

});

async function checkRule(key, check) {
    const source = check.before;
    const npmGroovyLintConfig = {
        source: source,
        format: true,
        nolintafter: true,
        output: 'none',
        verbose: true
    };
    const linter = await new NpmGroovyLint(
        npmGroovyLintConfig, {
        jdeployRootPath: 'jdeploy-bundle'
    }).run();

    assert(linter.lintResult.summary.totalFixedNumber >= check.totalFixed, `${check.totalFixed} Errors have been fixed (${linter.lintResult.summary.totalFixedNumber} returned)`);
    const result = linter.lintResult.files[0].updatedSource;
    const expectedResult = check.after;
    const effectiveDiff = getDiff(expectedResult, result, source)
    assert(linter.status === 0, 'Status is 0');
    assert(effectiveDiff.length === 0, 'Code has been formatted correctly');
    checkCodeNarcCallsCounter(check.codeNarcCallsCounter);
}

function getSamplesMap() {
    return new Map([
        ['SourceWithIfElseBracesToFormat', {
            totalFixed: 4,
            codeNarcCallsCounter: 2,
            before: `
private void doSomething(){
            if (a == 2)
                doSomething();
}
`,
            after: `
private void doSomething() {
    if (a == 2) {
        doSomething()
    }
}
`
        }
        ],
        ['OnlyNonCodeNarcFormatRules', {
            totalFixed: 0,
            codeNarcCallsCounter: 1,
            before: `
    // There is a comment badly aligned here
if (a == 2) {
            // And here too
    x = 1
    }
`,
            after: `
// There is a comment badly aligned here
if (a == 2) {
    // And here too
    x = 1
}
`
        }
        ]
    ]);

}
