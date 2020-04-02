#! /usr/bin/env node
"use strict";
const util = require("util");
let assert = require('assert');
const fse = require("fs-extra");
const childProcess = require("child_process");
const exec = util.promisify(childProcess.exec);
const spawn = childProcess.spawnSync;

const { SAMPLE_FILE_SMALL, NPM_GROOVY_LINT } = require('./helpers/common');

describe('Lint with executables (jdeploy-bundle)', () => {
    it('(EXE:file) should generate text console output', async () => {
        const params = [
            '--path', '"jdeploy-bundle/lib/example"',
            '--files', '**/' + SAMPLE_FILE_SMALL,
            '--loglevel', 'warning',
            '--verbose'
        ];
        const { stdout, stderr } = await exec(NPM_GROOVY_LINT + params.join(' '));
        if (stderr) {
            console.error(stderr);
        }
        assert(stdout, 'stdout is set');
        assert(stdout.includes('warning'), 'stdout should contain word "warning"');
    });
    it('(EXE:file) should generate json console output', async () => {
        const params = [
            '--path', '"jdeploy-bundle/lib/example"',
            '--files', '**/' + SAMPLE_FILE_SMALL,
            '--output', 'json'
        ];
        const { stdout, stderr } = await exec(NPM_GROOVY_LINT + params.join(' '));
        if (stderr) {
            console.error(stderr);
        }
        assert(stdout, 'stdout is set');
        assert(stdout.includes(`"totalFoundWarningNumber":`), 'Property totalFoundWarningNumber is in result');
    });

    it('(EXE:file) should generate codenarc HTML file report', async () => {
        const params = [
            '--codenarcargs',
            '-basedir="jdeploy-bundle/lib/example"',
            '-title="TestTitleCodenarc"',
            '-maxPriority1Violations=0',
            '-report="html:ReportTestCodenarc.html"'];
        await exec(NPM_GROOVY_LINT + params.join(' '));
        assert(fse.existsSync('ReportTestCodenarc.html'), 'html CodeNarc report has been generated');
        fse.removeSync('ReportTestCodenarc.html');
    });

    it('(EXE:file) should generate codenarc XML file report', async () => {
        const params = [
            '--codenarcargs',
            '-basedir="jdeploy-bundle/lib/example"',
            '-title="TestTitleCodenarc"',
            '-maxPriority1Violations=0',
            '-report="xml:ReportTestCodenarc.xml"'];
        await exec(NPM_GROOVY_LINT + params.join(' '));
        assert(fse.existsSync('ReportTestCodenarc.xml'), 'xml CodeNarc report has been generated');
        fse.removeSync('ReportTestCodenarc.xml');
    });

    it('(EXE:file) should run on a Jenkinsfile', async () => {
        const params = [
            '--path', ' "jdeploy-bundle/lib/example"',
            '--files', '**/Jenkinsfile',
            '--verbose'];
        const { stdout, stderr } = await exec(NPM_GROOVY_LINT + params.join(' '));
        if (stderr) {
            console.error(stderr);
        }
        assert(stdout, 'stdout is set');
        assert(stdout.includes('warning'), 'stdout should contain word "warning"');
    });

    it('(EXE:help) should show npm-groovy-lint help', async () => {
        const params = [
            '-h'
        ];
        const { stdout, stderr } = await exec(NPM_GROOVY_LINT + params.join(' '));
        if (stderr) {
            console.error(stderr);
        }
        assert(stdout, 'stdout is set');
        assert(stdout.includes('--verbose'), 'stdout should contain word "--verbose"');
    });

    it('(EXE:help) should show codenarc help', async () => {
        const params = [
            '--codenarcargs',
            '-help'
        ];
        const { stdout, stderr } = await exec(NPM_GROOVY_LINT + params.join(' '));
        if (stderr) {
            console.error(stderr);
        }
        assert(stdout, 'stdout is set');
        assert(stdout.includes('where OPTIONS are zero or more command-line options'), 'stdout should contain word "where OPTIONS are zero or more command-line options"');
    });

    it('(EXE:file) failonerror', async () => {
        const params = [
            '--path', '"jdeploy-bundle/lib/example"',
            '--files', '**/' + SAMPLE_FILE_SMALL,
            '--failonerror',
            '--output', 'txt'
        ];
        const { stderr, status } = spawn(NPM_GROOVY_LINT + params.join(' '), [], { shell: true });
        if (stderr) {
            console.error(stderr.toString());
        }
        assert(status === 1, `Status code is 1 (returned: ${status})`);
    });

    it('(EXE:file) failonwarning', async () => {
        const params = [
            '--path', '"jdeploy-bundle/lib/example"',
            '--files', '**/' + SAMPLE_FILE_SMALL,
            '--failonwarning',
            '--output', 'txt'
        ];
        const { stderr, status } = spawn(NPM_GROOVY_LINT + params.join(' '), [], { shell: true });
        if (stderr) {
            console.error(stderr.toString());
        }
        assert(status === 1, `Status code is 1 (returned: ${status})`);
    });

    it('(EXE:file) failoninfo', async () => {
        const params = [
            '--path', '"jdeploy-bundle/lib/example"',
            '--files', '**/' + SAMPLE_FILE_SMALL,
            '--failoninfo',
            '--output', 'txt'
        ];
        const { stderr, status } = spawn(NPM_GROOVY_LINT + params.join(' '), [], { shell: true });
        if (stderr) {
            console.error(stderr.toString());
        }
        assert(status === 1, `Status code is 1 (returned: ${status})`);
    });

});
