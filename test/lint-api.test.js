#! /usr/bin/env node
"use strict";
const NpmGroovyLint = require('../src/groovy-lint.js');
let assert = require('assert');
const fse = require("fs-extra");
const { beforeEachTestCase,
    checkCodeNarcCallsCounter,
    SAMPLE_FILE_PARSE_ERROR_PATH,
    SAMPLE_FILE_SMALL,
    SAMPLE_FILE_SMALL_PATH } = require('./helpers/common');

describe('Lint with API', () => {
    beforeEach(beforeEachTestCase);

    it('(API:file) should generate text console output', async () => {
        const linter = await new NpmGroovyLint([
            process.execPath,
            '',
            '--path', '"jdeploy-bundle/lib/example"',
            '--files', '**/' + SAMPLE_FILE_SMALL,
            '--verbose'
        ], {
            jdeployRootPath: 'jdeploy-bundle',
            verbose: true
        }).run();
        assert(linter.status === 0, `Linter status is 0 (${linter.status} returned)`);
        assert(linter.outputString.includes('warning'), 'Output string contains warning');
        assert(linter.lintResult.summary.totalFoundWarningNumber > 0, 'Warnings found');
        assert(linter.lintResult.summary.totalFoundInfoNumber > 0, 'Infos found');
        checkCodeNarcCallsCounter(1);
    });

    it('(API:file) should generate json output with rules', async () => {
        const linter = await new NpmGroovyLint([
            process.execPath,
            '',
            '--path', '"jdeploy-bundle/lib/example"',
            '--files', '**/' + SAMPLE_FILE_SMALL,
            '--output', 'json',
            '--loglevel', 'warning'
        ],
            { jdeployRootPath: 'jdeploy-bundle' }).run();
        assert(linter.status === 0, `Linter status is 0 (${linter.status} returned)`);
        assert(linter.outputString.includes(`"totalFoundWarningNumber":`), 'Property totalFoundWarningNumber is in result');
        assert(linter.lintResult.summary.totalFoundWarningNumber > 0, 'Warnings found');
        checkCodeNarcCallsCounter(1);
    });

    it('(API:file) should generate codenarc HTML file report', async () => {
        const reportFileName = 'ReportTestCodenarc.html';
        const linter = await new NpmGroovyLint([
            process.execPath,
            '',
            '--path', 'jdeploy-bundle/lib/example',
            '--files', '**/' + SAMPLE_FILE_SMALL,
            '--output', reportFileName],
            { jdeployRootPath: 'jdeploy-bundle' }).run();

        assert(linter.status === 0, `Linter status is 0 (${linter.status} returned)`);
        assert(fse.existsSync(reportFileName), 'CodeNarc HTML report generated');
        fse.removeSync(reportFileName);
        checkCodeNarcCallsCounter(1);
    });

    it('(API:file) should generate codenarc XML file report', async () => {
        const reportFileName = "ReportTestCodenarc.xml";
        const linter = await new NpmGroovyLint([
            process.execPath,
            '',
            '--path', 'jdeploy-bundle/lib/example',
            '--files', '**/' + SAMPLE_FILE_SMALL,
            '--output', reportFileName],
            { jdeployRootPath: 'jdeploy-bundle' }).run();

        assert(linter.status === 0, `Linter status is 0 (${linter.status} returned)`);
        assert(fse.existsSync(reportFileName), 'CodeNarc XML report generated');
        fse.removeSync(reportFileName);
        checkCodeNarcCallsCounter(1);
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

        assert(linter.status === 0, `Linter status is 0 (${linter.status} returned)`);
        assert(fse.existsSync(reportFileName), 'XML CodeNarc report has been generated');
        fse.removeSync(reportFileName);
        checkCodeNarcCallsCounter(1);
    });

    it('(API:file) should run on a Jenkinsfile', async () => {
        const linter = await new NpmGroovyLint([
            process.execPath,
            '',
            '--path', '"jdeploy-bundle/lib/example"',
            '-f', '**/Jenkinsfile',
            '--verbose'
        ], {
            jdeployRootPath: 'jdeploy-bundle',
            verbose: true
        }).run();
        assert(linter.status === 0, `Linter status is 0 (${linter.status} returned)`);
        assert(linter.outputString.includes('warning'), 'Output string contains warning');
        assert(linter.lintResult.summary.totalFoundWarningNumber > 0, 'Warnings found');
        assert(linter.lintResult.summary.totalFoundInfoNumber > 0, 'Infos found');
        checkCodeNarcCallsCounter(1);
    });

    it('(API:source) should run with source only (no parsing)', async () => {
        const npmGroovyLintConfig = {
            source: fse.readFileSync(SAMPLE_FILE_SMALL_PATH).toString(),
            sourcefilepath: SAMPLE_FILE_SMALL_PATH,
            output: 'txt',
            verbose: true
        };
        const linter = await new NpmGroovyLint(
            npmGroovyLintConfig, {
            jdeployRootPath: 'jdeploy-bundle'
        }).run();
        assert(linter.status === 0, `Linter status is 0 (${linter.status} returned)`);
        assert(linter.lintResult.files[0].errors.length > 0, 'Errors have been found');
        checkCodeNarcCallsCounter(1);
    });

    it('(API:source) should run with source only (parse success)', async () => {
        const npmGroovyLintConfig = {
            source: fse.readFileSync(SAMPLE_FILE_SMALL_PATH).toString(),
            sourcefilepath: SAMPLE_FILE_SMALL_PATH,
            output: 'txt',
            parse: true,
            verbose: true
        };
        const linter = await new NpmGroovyLint(
            npmGroovyLintConfig, {
            jdeployRootPath: 'jdeploy-bundle'
        }).run();
        assert(linter.status === 0, `Linter status is 0 (${linter.status} returned)`);
        assert(linter.lintResult.files[0].errors.length > 0, 'Errors have been found');
        checkCodeNarcCallsCounter(1);
    });

    it('(API:source) should run with source only (parse error)', async () => {
        const npmGroovyLintConfig = {
            source: fse.readFileSync(SAMPLE_FILE_PARSE_ERROR_PATH).toString(),
            sourcefilepath: SAMPLE_FILE_PARSE_ERROR_PATH,
            output: 'txt',
            parse: true,
            verbose: true
        };
        const linter = await new NpmGroovyLint(
            npmGroovyLintConfig, {
            jdeployRootPath: 'jdeploy-bundle'
        }).run();
        assert(linter.status === 0, `Linter status is 0 (${linter.status} returned)`);
        assert(linter.lintResult.files[0].errors.length > 0, 'Errors have been found');
        checkCodeNarcCallsCounter(1);
    });

    it('(API:source) should run without CodeNarc Server', async () => {
        const npmGroovyLintConfig = {
            source: fse.readFileSync(SAMPLE_FILE_SMALL_PATH).toString(),
            sourcefilepath: SAMPLE_FILE_SMALL_PATH,
            noserver: true,
            output: 'none',
            verbose: true
        };
        const linter = await new NpmGroovyLint(
            npmGroovyLintConfig, {
            jdeployRootPath: 'jdeploy-bundle'
        }).run();
        assert(linter.status === 0, `Linter status is 0 (${linter.status} returned)`);
        assert(linter.lintResult.files[0].errors.length > 0, 'Errors have been found');
        checkCodeNarcCallsCounter(1);
    });
});
