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

    it('(API:file) should format when if else braces added', async () => {
        const source = getSourceWithIfElseBracesToFormatBefore()
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

        assert(linter.lintResult.summary.totalFixedNumber >= 4, `4 Errors have been fixed (${linter.lintResult.summary.totalFixedNumber} returned)`);
        const result = linter.lintResult.files[0].updatedSource;
        const expectedResult = getSourceWithIfElseBracesToFormatAfter();
        const effectiveDiff = getDiff(expectedResult, result, source)
        assert(linter.status === 0, 'Status is 0');
        assert(effectiveDiff.length === 0, 'Code has been formatted correctly');
        checkCodeNarcCallsCounter(2);
    }).timeout(30000);

});

function getSourceWithIfElseBracesToFormatBefore() {
    return `
  private void doSomething(){
             if (a == 2)
                 doSomething();
}
`;
}

function getSourceWithIfElseBracesToFormatAfter() {
    return `
private void doSomething() {
    if (a == 2) {
        doSomething()
    }
}
`;
}

