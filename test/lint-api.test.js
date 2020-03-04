#! /usr/bin/env node
"use strict";
const NpmGroovyLint = require('../src/groovy-lint.js');
let assert = require('assert');
const fse = require("fs-extra");

describe('TEST npm-groovy-lint using API', () => {

    it('(API:file) should generate text console output', async () => {
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
        assert(linter.status === 0, 'Status is 0');
        assert(linter.nglOutputString.includes('warning'), 'Output string contains warning');
        assert(linter.lintResult.summary.totalFoundWarningNumber > 0, 'Warnings found');
        assert(linter.lintResult.summary.totalFoundInfoNumber > 0, 'Infos found');
    });

    it('(API:file) should generate json output', async () => {
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
        assert(linter.lintResult.summary.totalFoundWarningNumber > 0, 'Warnings found');
        assert(linter.lintResult.summary.totalFoundInfoNumber > 0, 'Infos found');
    });

    it('(API:file) should generate codenarc HTML file report', async () => {
        const linter = await new NpmGroovyLint([
            process.execPath,
            '',
            '--files', '**/Jenkinsfile',
            '--rulesets', '"jdeploy-bundle/lib/example/RuleSet-All.groovy"',
            '--output', 'ReportTestCodenarc.html'],
            { jdeployRootPath: 'jdeploy-bundle' }).run();

        assert(linter.status === 0 && fse.existsSync('ReportTestCodenarc.html'), 'CodeNarc HTML report generated');

        fse.removeSync('ReportTestCodenarc.html');
    });

    it('(API:file) should use --codenarcargs to generate XML report', async () => {
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

        assert(linter.status === 0 && fse.existsSync('ReportTestCodenarc.xml'), 'XML CodeNarc report has been generated');

        fse.removeSync('ReportTestCodenarc.xml');
    });

    it('(API:file) should run on a Jenkinsfile', async () => {
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
        assert(linter.status === 0 && linter.nglOutputString.includes('warning'), 'Output string contains warning');
        assert(linter.lintResult.summary.totalFoundWarningNumber > 0, 'Warnings found');
        assert(linter.lintResult.summary.totalFoundInfoNumber > 0, 'Infos found');
    });

    it('(API:Server) should kill running server', async () => {
        const linter = await new NpmGroovyLint([
            process.execPath,
            '',
            '--killserver',
            '--verbose'
        ], {
            jdeployRootPath: 'jdeploy-bundle',
            verbose: true
        }).run();
        if (process.platform.includes('win')) {
            assert(linter.status === 0 && linter.nglOutputString.includes('CodeNarcServer terminated'), 'CodeNarcServer has been terminated');
        }
        else {
            console.log('Test (API:Server) should kill running server skipped: CodeNarcServer works only on windows for now , and we are on ' + process.platform);
        }
    });

    it('(API:Server) should not succeeed to kill running server', async () => {
        const linter = await new NpmGroovyLint([
            process.execPath,
            '',
            '--killserver',
            '--verbose'
        ], {
            jdeployRootPath: 'jdeploy-bundle',
            verbose: true
        }).run();
        assert(linter.status === 0 && linter.nglOutputString.includes('CodeNarcServer was not running'), 'CodeNarcServer not killed because not running');
    });

    it('(API:help) should show npm-groovy-lint help', async () => {
        const linter = await new NpmGroovyLint([
            process.execPath,
            '',
            '-h'], {
            jdeployRootPath: 'jdeploy-bundle'
        }).run();
        assert(linter.status === 0 && linter.nglOutputString.includes('--verbose'));
    });


    it('(API:help) should show npm-groovy-lint help option', async () => {
        const linter = await new NpmGroovyLint([
            process.execPath,
            '',
            '-h', 'source'], {
            jdeployRootPath: 'jdeploy-bundle'
        }).run();

        assert(linter.status === 0 && linter.nglOutputString.includes('-s, --source'), 'npm-groovy-lint Help is displayed');
    });

    it('(API:help) should show npm-groovy-lint version', async () => {
        process.env.npm_package_version = ""; // NV: Do nto use npm_package_version to have more code coverage :)
        const linter = await new NpmGroovyLint([
            process.execPath,
            '',
            '-v'], {
            jdeployRootPath: 'jdeploy-bundle'
        }).run();
        assert(linter.status === 0 && linter.nglOutputString.includes('npm-groovy-lint v'));
    });

    it('(API:help) should show codenarc help', async () => {
        const linter = await new NpmGroovyLint([
            process.execPath,
            '',
            '--codenarcargs',
            '-help'], {
            jdeployRootPath: 'jdeploy-bundle'
        }).run();
        assert(linter.status === 0 && linter.codeNarcStdOut.includes('where OPTIONS are zero or more command-line options'), 'CodeNarc help is displayed');
    });


    it('(API:source) should run with source only', async () => {
        const npmGroovyLintConfig = {
            source: fse.readFileSync('lib/example/SampleFile.groovy').toString(),
            output: 'none',
            verbose: true
        };
        const linter = await new NpmGroovyLint(
            npmGroovyLintConfig, {
            jdeployRootPath: 'jdeploy-bundle'
        }).run();
        assert(linter.status === 0 && linter.lintResult.files[0].errors.length > 0, 'Errors have been found');
    });

    it('(API:source) should run without CodeNarc Server', async () => {
        const npmGroovyLintConfig = {
            source: fse.readFileSync('lib/example/SampleFile.groovy').toString(),
            noserver: true,
            output: 'none',
            verbose: true
        };
        const linter = await new NpmGroovyLint(
            npmGroovyLintConfig, {
            jdeployRootPath: 'jdeploy-bundle'
        }).run();
        assert(linter.status === 0 && linter.lintResult.files[0].errors.length > 0, 'Errors have been found');
    });




});
