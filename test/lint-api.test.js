#! /usr/bin/env node
"use strict";
const NpmGroovyLint = require('../src/groovy-lint.js');
let assert = require('assert');
const fse = require("fs-extra");

describe('Lint with API', () => {

    it('(API:file) should generate text console output', async () => {
        const linter = await new NpmGroovyLint([
            process.execPath,
            '',
            '--path', '"jdeploy-bundle/lib/example"',
            '--files', '**/SampleFile.groovy',
            '--verbose'
        ], {
            jdeployRootPath: 'jdeploy-bundle',
            verbose: true
        }).run();
        assert(linter.status === 0, 'Status is 0');
        assert(linter.outputString.includes('warning'), 'Output string contains warning');
        assert(linter.lintResult.summary.totalFoundWarningNumber > 0, 'Warnings found');
        assert(linter.lintResult.summary.totalFoundInfoNumber > 0, 'Infos found');
    });

    it('(API:file) should generate json output with rules', async () => {
        const linter = await new NpmGroovyLint([
            process.execPath,
            '',
            '--path', '"jdeploy-bundle/lib/example"',
            '--files', '**/SampleFile.groovy',
            '--output', 'json',
            '--loglevel', 'warning'
        ],
            { jdeployRootPath: 'jdeploy-bundle' }).run();
        assert(linter.status === 0, 'Status is 0');
        assert(linter.outputString.includes(`"totalFoundWarningNumber":`), 'Property totalFoundWarningNumber is in result');
        assert(linter.lintResult.summary.totalFoundWarningNumber > 0, 'Warnings found');
    });

    it('(API:file) should generate codenarc HTML file report', async () => {
        const reportFileName = 'ReportTestCodenarc.html';
        const linter = await new NpmGroovyLint([
            process.execPath,
            '',
            '--path', 'jdeploy-bundle/lib/example',
            '--files', '**/Jenkinsfile',
            '--output', reportFileName],
            { jdeployRootPath: 'jdeploy-bundle' }).run();

        assert(linter.status === 0, 'Status is 0');
        assert(fse.existsSync(reportFileName), 'CodeNarc HTML report generated');
        fse.removeSync(reportFileName);
    });

    it('(API:file) should generate codenarc XML file report', async () => {
        const reportFileName = "ReportTestCodenarc.xml";
        const linter = await new NpmGroovyLint([
            process.execPath,
            '',
            '--path', 'jdeploy-bundle/lib/example',
            '--files', '**/Jenkinsfile',
            '--output', reportFileName],
            { jdeployRootPath: 'jdeploy-bundle' }).run();

        assert(linter.status === 0, 'Status is 0');
        assert(fse.existsSync(reportFileName), 'CodeNarc XML report generated');
        fse.removeSync(reportFileName);
    });

    it('(API:file) should use --codenarcargs to generate XML report', async () => {
        const reportFileName = "./ReportTestCodenarc.xml";
        const linter = await new NpmGroovyLint([
            process.execPath,
            '',
            '--codenarcargs',
            '-basedir="jdeploy-bundle/lib/example"',
            '-title="TestTitleCodenarc"',
            '-maxPriority1Violations=0',
            `-report="xml:${reportFileName}"`],
            { jdeployRootPath: 'jdeploy-bundle' }).run();

        assert(linter.status === 0, 'Status is 0');
        assert(fse.existsSync(reportFileName), 'XML CodeNarc report has been generated');
        fse.removeSync(reportFileName);
    });

    it('(API:file) should run on a Jenkinsfile', async () => {
        const linter = await new NpmGroovyLint([
            process.execPath,
            '',
            '--path', '"jdeploy-bundle/lib/example"',
            '-f', '"**/Jenkinsfile"',
            '--verbose'
        ], {
            jdeployRootPath: 'jdeploy-bundle',
            verbose: true
        }).run();
        assert(linter.status === 0, 'Status is 0');
        assert(linter.outputString.includes('warning'), 'Output string contains warning');
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
        if (process.platform.includes('win')) { // Doesn't work in Linux yet :/ 
            assert(linter.status === 0, 'Status is 0');
            assert(linter.outputString.includes('CodeNarcServer terminated'), 'CodeNarcServer has been terminated');
        }
        else {
            console.log('Test (API:Server) should kill running server skipped: CodeNarcServer works only on windows for now , and we are on ' + process.platform);
        }
    });

    it('(API:Server) should not succeed to kill running server', async () => {
        const linter = await new NpmGroovyLint([
            process.execPath,
            '',
            '--killserver',
            '--verbose'
        ], {
            jdeployRootPath: 'jdeploy-bundle',
            verbose: true
        }).run();
        assert(linter.status === 0, 'Status is 0');
        assert(linter.outputString.includes('CodeNarcServer was not running'), 'CodeNarcServer not killed because not running');
    });

    it('(API:help) should show npm-groovy-lint help', async () => {
        const linter = await new NpmGroovyLint([
            process.execPath,
            '',
            '-h'], {
            jdeployRootPath: 'jdeploy-bundle'
        }).run();
        assert(linter.status === 0, 'Status is 0');
        assert(linter.outputString.includes('--verbose'), '--verbose is found in output text');
    });


    it('(API:help) should show npm-groovy-lint help option', async () => {
        const linter = await new NpmGroovyLint([
            process.execPath,
            '',
            '-h', 'source'], {
            jdeployRootPath: 'jdeploy-bundle'
        }).run();
        assert(linter.status === 0, 'Status is 0');
        assert(linter.outputString.includes('-s, --source'), 'npm-groovy-lint Help is displayed');
    });

    it('(API:help) should show npm-groovy-lint version', async () => {
        process.env.npm_package_version = ""; // NV: Do nto use npm_package_version to have more code coverage :)
        const linter = await new NpmGroovyLint([
            process.execPath,
            '',
            '-v'], {
            jdeployRootPath: 'jdeploy-bundle'
        }).run();
        assert(linter.status === 0, 'Status is 0');
        assert(linter.outputString.includes('npm-groovy-lint v'), 'Provides version');
    });

    it('(API:help) should show codenarc help', async () => {
        const linter = await new NpmGroovyLint([
            process.execPath,
            '',
            '--codenarcargs',
            '-help'], {
            jdeployRootPath: 'jdeploy-bundle'
        }).run();
        assert(linter.status === 0, 'Status is 0');
        assert(linter.codeNarcStdOut.includes('where OPTIONS are zero or more command-line options'), 'CodeNarc help is displayed');
    });


    it('(API:source) should run with source only', async () => {
        const sampleFilePath = 'lib/example/SampleFile.groovy';
        const npmGroovyLintConfig = {
            source: fse.readFileSync(sampleFilePath).toString(),
            sourcefilepath: sampleFilePath,
            output: 'txt',
            verbose: true
        };
        const linter = await new NpmGroovyLint(
            npmGroovyLintConfig, {
            jdeployRootPath: 'jdeploy-bundle'
        }).run();
        assert(linter.status === 0, 'Status is 0');
        assert(linter.lintResult.files[0].errors.length > 0, 'Errors have been found');
    });

    it('(API:source) should run without CodeNarc Server', async () => {
        const sampleFilePath = 'lib/example/SampleFile.groovy';
        const npmGroovyLintConfig = {
            source: fse.readFileSync(sampleFilePath).toString(),
            sourcefilepath: sampleFilePath,
            noserver: true,
            output: 'none',
            verbose: true
        };
        const linter = await new NpmGroovyLint(
            npmGroovyLintConfig, {
            jdeployRootPath: 'jdeploy-bundle'
        }).run();
        assert(linter.status === 0, 'Status is 0');
        assert(linter.lintResult.files[0].errors.length > 0, 'Errors have been found');
    });

});
