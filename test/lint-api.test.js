#! /usr/bin/env node
"use strict";
const NpmGroovyLint = require('../src/groovy-lint.js');
let assert = require('assert');
const fse = require("fs-extra");

describe('TEST npm-groovy-lint using API', () => {

    it('(API) should generate text console output', async () => {
        const linter = await new NpmGroovyLint([
            process.execPath,
            '',
            '--path', '"jdeploy-bundle/lib/example"',
            '--files', '**/SampleFile.groovy',
            '--rulesets', '"jdeploy-bundle/lib/example/RuleSet-Groovy.groovy"',
            '--verbose'
        ], {
            jdeployRootPath: 'jdeploy-bundle',
            verbose: true
        }).run();
        assert(linter.status === 0 && linter.nglOutputString.includes('warning'), 'Script failure');
    });

    it('(API) should generate json output', async () => {
        const linter = await new NpmGroovyLint([
            process.execPath,
            '',
            '--path', '"jdeploy-bundle/lib/example"',
            '--files', '**/SampleFile.groovy',
            '--rulesets', '"jdeploy-bundle/lib/example/RuleSet-Groovy.groovy"',
            '--output', 'json',
            '--loglevel', 'warning'
        ],
            { jdeployRootPath: 'jdeploy-bundle' }).run();
        assert(linter.status === 0 && linter.nglOutputString.includes('"totalFilesWithErrorsNumber"'), 'Script failure');
    });

    it('(API) should generate codenarc HTML file report', async () => {
        const linter = await new NpmGroovyLint([
            process.execPath,
            '',
            '--files', '**/Jenkinsfile',
            '--rulesets', '"jdeploy-bundle/lib/example/RuleSet-All.groovy"',
            '--output', 'ReportTestCodenarc.html'],
            { jdeployRootPath: 'jdeploy-bundle' }).run();
        assert(linter.status === 0 && fse.existsSync('ReportTestCodenarc.html'), 'Script failure');
        fse.removeSync('ReportTestCodenarc.html');
    });

    it('(API) should use --codenarcargs to generate XML report', async () => {
        const linter = await new NpmGroovyLint([
            process.execPath,
            '',
            '--codenarcargs',
            '-basedir="jdeploy-bundle/lib/example"',
            '-rulesetfiles="file:jdeploy-bundle/lib/example/RuleSet-Groovy.groovy"',
            '-title="TestTitleCodenarc"',
            '-maxPriority1Violations=0',
            '-report="xml:ReportTestCodenarc.xml"'],
            { jdeployRootPath: 'jdeploy-bundle' }).run();
        assert(linter.status === 0 && fse.existsSync('ReportTestCodenarc.xml'), 'Script failure');
        fse.removeSync('ReportTestCodenarc.xml');
    });

    it('(API) should run on a Jenkinsfile', async () => {
        const linter = await new NpmGroovyLint([
            process.execPath,
            '',
            '--path', '"jdeploy-bundle/lib/example"',
            '-f', '"**/Jenkinsfile"',
            '-r', '"jdeploy-bundle/lib/example/RuleSet-Jenkinsfile.groovy"',
            '--verbose'
        ], {
            jdeployRootPath: 'jdeploy-bundle',
            verbose: true
        }).run();
        assert(linter.status === 0 && linter.nglOutputString.includes('warning'), 'Script failure');
    });

    it('(API) should show npm-groovy-lint help', async () => {
        const linter = await new NpmGroovyLint([
            process.execPath,
            '',
            '-h'], {
            jdeployRootPath: 'jdeploy-bundle'
        }).run();
        assert(linter.status === 0 && linter.nglOutputString.includes('-v, --verbose'));
    });


    it('(API) should show npm-groovy-lint help option', async () => {
        const linter = await new NpmGroovyLint([
            process.execPath,
            '',
            '-h', 'source'], {
            jdeployRootPath: 'jdeploy-bundle'
        }).run();
        assert(linter.status === 0 && linter.nglOutputString.includes('-s, --source'));
    });

    it('(API) should show codenarc help', async () => {
        const linter = await new NpmGroovyLint([
            process.execPath,
            '',
            '--codenarcargs',
            '-help'], {
            jdeployRootPath: 'jdeploy-bundle'
        }).run();
        assert(linter.status === 0 && linter.codeNarcStdOut.includes('where OPTIONS are zero or more command-line options'), 'Script failure');
    });


    it('(API) should run with source only', async () => {
        const npmGroovyLintConfig = {
            source: fse.readFileSync('lib/example/SampleFile.groovy').toString(),
            output: 'none',
            verbose: true
        };
        const linter = await new NpmGroovyLint(
            npmGroovyLintConfig, {
            jdeployRootPath: 'jdeploy-bundle'
        }).run();
        assert(linter.status === 0 && linter.lintResult.files[0].errors.length > 0, 'Script failure');
    });




});
