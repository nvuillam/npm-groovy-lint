#! /usr/bin/env node
"use strict";
const NpmGroovyLint = require('../src/groovy-lint.js');
let assert = require('assert');
const fse = require("fs-extra");

describe('Lint & fix with API', function () {

    it('(API:source) should lint then fix only a list of errors', async () => {
        const prevFileContent = fse.readFileSync('./lib/example/SampleFile.groovy').toString();
        const npmGroovyLintConfig = {
            source: prevFileContent,
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
        const prevFileContent = fse.readFileSync('./lib/example/SampleFile.groovy').toString();
        const npmGroovyLintConfig = {
            source: prevFileContent,
            fix: true,
            output: 'none',
            verbose: true
        };
        const linter = await new NpmGroovyLint(
            npmGroovyLintConfig, {
            jdeployRootPath: 'jdeploy-bundle'
        }).run();

        assert(linter.status === 0, 'Status is 0');
        assert(linter.lintResult.summary.totalFixedNumber >= 5, 'Errors have been fixed');
        assert(linter.lintResult.files[0].updatedSource &&
            linter.lintResult.files[0].updatedSource !== prevFileContent,
            'Source has been updated');
        assert(!linter.outputString.includes('NaN'), 'Results does not contain NaN');
    });

    it('(API:file) should lint and fix a Jenkinsfile in one shot', async function () {
        const prevFileContent = fse.readFileSync('./jdeploy-bundle/lib/example/Jenkinsfile').toString();
        const linter = await new NpmGroovyLint([
            process.execPath,
            '',
            '--output', '"npm-groovy-fix-log.json"',
            '--path', '"jdeploy-bundle/lib/example"',
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
    }).timeout(120000);


    it('(API:file) should fix only some errors', async function () {
        const allRules = [
            // Line rules or not changing line rules

            "Indentation" // ok
            // "UnnecessaryGString", 
            // "SpaceBeforeOpeningBrace", 
            // "SpaceAfterOpeningBrace",
            // "SpaceAfterCatch", 
            // "SpaceAroundOperator",
            // "SpaceAfterComma",
            // "UnnecessaryDefInFieldDeclaration", 
            // "UnnecessarySemicolon", 
            // "IfStatementBraces",
            // "ElseStatementBraces", 
            // "ConsecutiveBlankLines", 
            // "IndentationClosingBraces",
            // "IndentationComments",
            // "FileEndsWithoutNewline" // ok
        ];
        const linter = await new NpmGroovyLint([
            process.execPath,
            '',
            '--path', '"jdeploy-bundle/lib/example"',
            '--fixrules', allRules.join(','),
            '--output', '"npm-groovy-fix-log.txt"',
            '--fix',
            '--verbose'], {
            jdeployRootPath: 'jdeploy-bundle',
        }).run();

        assert(linter.status === 0);
        assert(linter.lintResult.summary.totalFixedNumber > 0, 'Errors have been fixed');
        assert(fse.existsSync('npm-groovy-fix-log.txt'), 'Output txt file produced');
        assert(!linter.outputString.includes('NaN'), 'Results does not contain NaN');

        fse.removeSync('npm-groovy-fix-log.txt');
    }).timeout(60000);

    it('(API:file) should fix groovy files', async function () {
        const linter = await new NpmGroovyLint([
            process.execPath,
            '',
            '--path', '"jdeploy-bundle/lib/example"',
            '--output', '"npm-groovy-fix-log.txt"',
            '--fix',
            '--verbose'], {
            jdeployRootPath: 'jdeploy-bundle',
        }).run();

        assert(linter.status === 0, "Status is 0");
        assert(linter.lintResult.summary.totalFixedNumber > 0, 'Errors have been fixed');
        assert(fse.existsSync('npm-groovy-fix-log.txt'), 'Output txt file produced');
        assert(!linter.outputString.includes('NaN'), 'Results does not contain NaN');

        fse.removeSync('npm-groovy-fix-log.txt');
    }).timeout(120000);

});
