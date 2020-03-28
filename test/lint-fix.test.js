#! /usr/bin/env node
"use strict";
const NpmGroovyLint = require('../src/groovy-lint.js');
let assert = require('assert');
const fse = require("fs-extra");
const os = require("os");
const rimraf = require("rimraf");

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

describe('Lint & fix with API', function () {

    it('(API:source) should lint then fix only a list of errors', async () => {
        const sampleFilePath = './lib/example/SampleFile.groovy';
        const prevFileContent = fse.readFileSync(sampleFilePath).toString();
        const npmGroovyLintConfig = {
            source: prevFileContent,
            sourcefilepath: sampleFilePath,
            output: 'none',
            verbose: true
        };
        const linter = await new NpmGroovyLint(
            npmGroovyLintConfig, {
            jdeployRootPath: 'jdeploy-bundle'
        }).run();

        let errIdList = linter.lintResult.files[0].errors.filter(error => error.fixable === true).map(err => err.id);
        errIdList = errIdList.slice(0, 500);
        await linter.fixErrors(errIdList);

        assert(linter.status === 0, 'Status is 0');
        assert(linter.lintResult.summary.totalFixedNumber >= 100, 'Errors have been fixed'); // can be more than the five sent errors, as there are other triggered fixes
        assert(linter.lintResult.files[0].updatedSource &&
            linter.lintResult.files[0].updatedSource !== prevFileContent,
            'Source has been updated');
        assert(!linter.outputString.includes('NaN'), 'Results does not contain NaN');
    });

    it('(API:source) should lint and fix (one shot)', async () => {
        const sampleFilePath = './lib/example/SampleFile.groovy';
        const prevFileContent = fse.readFileSync(sampleFilePath).toString();
        const npmGroovyLintConfig = {
            source: prevFileContent,
            sourcefilepath: sampleFilePath,
            fix: true,
            output: 'none',
            verbose: true
        };
        const linter = await new NpmGroovyLint(
            npmGroovyLintConfig, {
            jdeployRootPath: 'jdeploy-bundle'
        }).run();

        assert(linter.status === 0, 'Status is 0');
        assert(linter.lintResult.summary.totalFixedNumber >= 975, 'Errors have been fixed');
        assert(linter.lintResult.files[0].updatedSource &&
            linter.lintResult.files[0].updatedSource !== prevFileContent,
            'Source has been updated');
        assert(!linter.outputString.includes('NaN'), 'Results does not contain NaN');

    }).timeout(200000);

    it('(API:file) should lint and fix a Jenkinsfile in one shot', async function () {
        const tmpDir = await copyFilesInTmpDir();
        const prevFileContent = fse.readFileSync(tmpDir + '/Jenkinsfile').toString();
        const linter = await new NpmGroovyLint([
            process.execPath,
            '',
            '--output', '"npm-groovy-fix-log.json"',
            '--path', '"' + tmpDir + '"',
            '--fix',
            '--verbose'], {
            jdeployRootPath: 'jdeploy-bundle',
        }).run();

        assert(linter.status === 0, "status is 0");
        assert(linter.lintResult.summary.totalFixedNumber > 0, 'Error have been fixed');
        assert(linter.lintResult.files[Object.keys(linter.lintResult.files)[0]].updatedSource !== prevFileContent,
            'File content has been updated');
        assert(fse.existsSync('npm-groovy-fix-log.json'), 'Output json file has been produced');
        assert(!linter.outputString.includes('NaN'), 'Results does not contain NaN');

        fse.removeSync('npm-groovy-fix-log.json');
        rimraf.sync(tmpDir);
        return true;
    }).timeout(120000);


    it('(API:file) should fix only some errors', async function () {
        const fixRules = [
            // Line rules or not changing line rules

            "Indentation", // ok
            // "UnnecessaryGString", 
            // "SpaceBeforeOpeningBrace", 
            // "SpaceAfterOpeningBrace",
            // "SpaceAfterCatch", 
            // "SpaceAroundOperator",
            // "SpaceAfterComma",
            // "UnnecessaryDefInFieldDeclaration", 
            "UnnecessarySemicolon",
            // "IfStatementBraces",
            // "ElseStatementBraces", 
            // "ConsecutiveBlankLines", 
            // "IndentationClosingBraces",
            // "IndentationComments",
            // "FileEndsWithoutNewline" // ok
        ];
        const tmpDir = await copyFilesInTmpDir();
        const linter = await new NpmGroovyLint([
            process.execPath,
            '',
            '--path', '"' + tmpDir + '"',
            '--fix',
            '--fixrules', fixRules.join(','),
            '--output', '"npm-groovy-fix-log-should-fix-only-some-errors.txt"',
            '--verbose'], {
            jdeployRootPath: 'jdeploy-bundle',
        }).run();

        assert(linter.status === 0);
        assert(linter.lintResult.summary.totalFixedNumber > 0, 'Errors have been fixed');
        assert(fse.existsSync('npm-groovy-fix-log-should-fix-only-some-errors.txt'), 'Output txt file produced');
        assert(!linter.outputString.includes('NaN'), 'Results does not contain NaN');

        fse.removeSync('npm-groovy-fix-log-should-fix-only-some-errors.txt');
        rimraf.sync(tmpDir);
        return true;
    }).timeout(120000);

    it('(API:file) should fix groovy files', async function () {
        const tmpDir = await copyFilesInTmpDir();
        const linter = await new NpmGroovyLint([
            process.execPath,
            '',
            '--path', '"' + tmpDir + '"',
            '--output', '"npm-groovy-fix-log-should-fix-groovy-files.txt"',
            '--fix',
            '--verbose'], {
            jdeployRootPath: 'jdeploy-bundle',
        }).run();

        assert(linter.status === 0, "Status is 0");
        assert(linter.lintResult.summary.totalFixedNumber > 0, 'Errors have been fixed');
        assert(fse.existsSync('npm-groovy-fix-log-should-fix-groovy-files.txt'), 'Output txt file produced');
        assert(!linter.outputString.includes('NaN'), 'Results does not contain NaN');

        fse.removeSync('npm-groovy-fix-log-should-fix-groovy-files.txt');
        rimraf.sync(tmpDir);
        return true;
    }).timeout(120000);

});
