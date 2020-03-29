#! /usr/bin/env node
"use strict";
const NpmGroovyLint = require('../src/groovy-lint.js');
let assert = require('assert');
const fse = require("fs-extra");
const os = require("os");
const rimraf = require("rimraf");

const sampleFileName = 'SampleFile.groovy';
const sampleFilePath = './lib/example/' + sampleFileName;

// Copy files in temp directory to not update the package files
async function copyFilesInTmpDir() {
    const rootTmpDir =
        (os.type().toLowerCase().includes('linux')) ?
            './jdeploy-bundle/tmptest' :
            os.tmpdir();
    const tmpDir = rootTmpDir + '/' + ('tmpGroovyLintTest_' + Math.random()).replace('.', '');
    await fse.ensureDir(tmpDir, { mode: '0777' });
    await fse.copy('./jdeploy-bundle/lib/example', tmpDir);
    console.info('GroovyLint: Copied ./jdeploy-bundle/lib/example into ' + tmpDir);
    return tmpDir;
}

describe('Format with API', function () {

    it('(API:source) should format code', async () => {
        const prevFileContent = fse.readFileSync(sampleFilePath).toString();
        const npmGroovyLintConfig = {
            source: prevFileContent,
            format: true,
            output: 'txt',
            verbose: true
        };
        const linter = await new NpmGroovyLint(
            npmGroovyLintConfig, {
            jdeployRootPath: 'jdeploy-bundle'
        }).run();

        assert(linter.status === 0, 'Status is 0');
        assert(linter.lintResult.summary.totalFixedNumber >= 972, 'Errors have been fixed');
        assert(linter.lintResult.files[0].updatedSource &&
            linter.lintResult.files[0].updatedSource !== prevFileContent,
            'Source has been updated');
        const fixedNbInLogs = (linter.outputString.match(/fixed/g) || []).length;
        assert(fixedNbInLogs >= 972, 'Result logs contain fixed errors');
        assert(!linter.outputString.includes('NaN'), 'Results does not contain NaN');

    }).timeout(100000);

    it('(API:file) should format code', async () => {
        const tmpDir = await copyFilesInTmpDir();
        const prevFileContent = fse.readFileSync(sampleFilePath).toString();
        const npmGroovyLintConfig = {
            path: tmpDir,
            files: `**/${sampleFileName}`,
            format: true,
            output: 'txt',
            verbose: true
        };
        const linter = await new NpmGroovyLint(
            npmGroovyLintConfig, {
            jdeployRootPath: 'jdeploy-bundle'
        }).run();

        assert(linter.status === 0, 'Status is 0');
        assert(linter.lintResult.summary.totalFixedNumber >= 972, 'Errors have been fixed');
        const newFileContent = fse.readFileSync(tmpDir + '/' + sampleFileName).toString();
        assert(newFileContent !== prevFileContent, 'File has been updated');
        const fixedNbInLogs = (linter.outputString.match(/fixed/g) || []).length;
        assert(fixedNbInLogs >= 972, 'Result logs contain fixed errors');
        assert(!linter.outputString.includes('NaN'), 'Results does not contain NaN');

        rimraf.sync(tmpDir);
    }).timeout(100000);

});
