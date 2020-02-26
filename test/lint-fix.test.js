#! /usr/bin/env node
"use strict";
const NpmGroovyLint = require('../src/groovy-lint.js');
let assert = require('assert');
const fse = require("fs-extra");

describe('TEST npm-groovy-lint fixes with API', function () {

    it('(API) should fix only a list of errors', async () => {
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
        errIdList = errIdList.slice(0, 5);
        await linter.fixErrors(errIdList);

        assert(linter.status === 0 &&
            linter.fixedErrorsNumber > 0 &&
            linter.lintResult.files[0].updatedSource &&
            linter.lintResult.files[0].updatedSource !== prevFileContent,
            'Script failure');
    });

    it('(API) should fix with source only', async () => {
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
        assert(linter.status === 0 &&
            linter.lintResult.files[0].updatedSource &&
            linter.lintResult.files[0].updatedSource !== prevFileContent,
            'Script failure');
    });

    it('(API) should fix a Jenkinsfile', async function () {
        const linter = await new NpmGroovyLint([
            process.execPath,
            '',
            '--output', '"npm-groovy-fix-log.json"',
            '--path', '"jdeploy-bundle/lib/example"',
            '--rulesets', 'Jenkinsfile',
            '--fix',
            '--verbose'], {
            jdeployRootPath: 'jdeploy-bundle',
        }).run();
        assert(linter.status === 0 && linter.fixer && linter.fixer.fixedErrorsNumber > 0, 'Script failure');
        assert(fse.existsSync('npm-groovy-fix-log.json'), 'Output json file not found');
        fse.removeSync('npm-groovy-fix-log.json');
    }).timeout(60000);


    it('(API) should fix only some errors', async function () {
        const allRules = [
            // Line rules or not changing line rules
            "NoTabCharacter", // ok
            //"TrailingWhitespace", // ok
            //    "Indentation", // ok
            "UnnecessaryGString", // ok
            "SpaceBeforeOpeningBrace", // ok
            "SpaceAfterOpeningBrace", // ok
            "SpaceAfterCatch", // ok
            "SpaceAroundOperator", // ok
            "SpaceAfterComma", // ok
            "UnnecessaryDefInFieldDeclaration", // not tested yet ?
            "UnnecessarySemicolon", // ok
            "IfStatementBraces", // ok
            "ElseStatementBraces", // ok
            "ConsecutiveBlankLines", // ok
            "ClosingBraceNotAlone", // Required for IfStatementBraces & ElseStatementBraces
            "IndentationClosingBraces",
            "IndentationComments",
            "FileEndsWithoutNewline" // ok
        ];
        const linter = await new NpmGroovyLint([
            process.execPath,
            '',
            '--path', '"jdeploy-bundle/lib/example"',
            '--fixrules', allRules.join(','),
            '--output', '"npm-groovy-fix-log.txt"',
            '--rulesets', 'Groovy',
            '--fix',
            '--verbose'], {
            jdeployRootPath: 'jdeploy-bundle',
        }).run();
        assert(linter.status === 0 && linter.fixer && linter.fixer.fixedErrorsNumber > 0, 'Script failure');
        assert(fse.existsSync('npm-groovy-fix-log.txt'), 'Output txt file not found')
        //fse.removeSync('npm-groovy-fix-log.txt');
    }).timeout(60000);

    it('(API) should fix groovy files', async function () {
        const linter = await new NpmGroovyLint([
            process.execPath,
            '',
            '--path', '"jdeploy-bundle/lib/example"',
            '--output', '"npm-groovy-fix-log.txt"',
            '--rulesets', 'Groovy',
            '--fix',
            '--verbose'], {
            jdeployRootPath: 'jdeploy-bundle',
        }).run();
        assert(linter.status === 0 && linter.fixer && linter.fixer.fixedErrorsNumber > 0, 'Script failure');
        assert(fse.existsSync('npm-groovy-fix-log.txt'), 'Output txt file not found')
        //fse.removeSync('npm-groovy-fix-log.txt');
    }).timeout(60000);

});
