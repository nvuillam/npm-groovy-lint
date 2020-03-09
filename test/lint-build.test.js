#! /usr/bin/env node
"use strict";
const util = require("util");
let assert = require('assert');
const fse = require("fs-extra");

const exec = util.promisify(require("child_process").exec);

describe('Lint with executables (jdeploy-bundle)', () => {
    it('(EXE:file) should generate text console output', async () => {
        const params = [
            '--path', '"jdeploy-bundle/lib/example"',
            '--rulesets', '"jdeploy-bundle/lib/example/RuleSet-Groovy.groovy"',
            '--loglevel', 'warning',
            '--verbose'
        ];
        const { stdout, stderr } = await exec('npm-groovy-lint ' + params.join(' '));
        if (stderr) {
            console.error(stderr);
        }
        assert(stdout, 'stdout is set');
        assert(stdout.includes('warning'), 'stdout should contain word "warning"');
    });
    it('(EXE:file) should generate json console output', async () => {
        const params = [
            '--path', '"jdeploy-bundle/lib/example"',
            '--rulesets', '"Groovy"',
            '--output', 'json'
        ];
        const { stdout, stderr } = await exec('npm-groovy-lint ' + params.join(' '));
        if (stderr) {
            console.error(stderr);
        }
        assert(stdout, 'stdout is set');
        assert(stdout.includes('"totalFilesWithErrorsNumber"'), 'stdout should contain word "totalFilesWithErrorsNumber"');
    });

    it('(EXE:file) should generate codenarc HTML file report', async () => {
        const params = [
            '--codenarcargs',
            '-basedir="jdeploy-bundle/lib/example"',
            '-rulesetfiles="file:jdeploy-bundle/lib/example/RuleSet-Groovy.groovy"',
            '-title="TestTitleCodenarc"',
            '-maxPriority1Violations=0',
            '-report="html:ReportTestCodenarc.html"'];
        await exec('npm-groovy-lint ' + params.join(' '));
        assert(fse.existsSync('ReportTestCodenarc.html'), 'html CodeNarc report has been generated');
        fse.removeSync('ReportTestCodenarc.html');
    });

    it('(EXE:file) should generate codenarc XML file report', async () => {
        const params = [
            '--codenarcargs',
            '-basedir="jdeploy-bundle/lib/example"',
            '-rulesetfiles="file:jdeploy-bundle/lib/example/RuleSet-Groovy.groovy"',
            '-title="TestTitleCodenarc"',
            '-maxPriority1Violations=0',
            '-report="xml:ReportTestCodenarc.xml"'];
        await exec('npm-groovy-lint ' + params.join(' '));
        assert(fse.existsSync('ReportTestCodenarc.xml'), 'xml CodeNarc report has been generated');
        fse.removeSync('ReportTestCodenarc.xml');
    });

    it('(EXE:file) should run on a Jenkinsfile', async () => {
        const params = [
            '--path', ' "jdeploy-bundle/lib/example"',
            '-r', '"Jenkinsfile"',
            '--verbose'];
        const { stdout, stderr } = await exec('npm-groovy-lint ' + params.join(' '));
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
        const { stdout, stderr } = await exec('npm-groovy-lint ' + params.join(' '));
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
        const { stdout, stderr } = await exec('npm-groovy-lint ' + params.join(' '));
        if (stderr) {
            console.error(stderr);
        }
        assert(stdout, 'stdout is set');
        assert(stdout.includes('where OPTIONS are zero or more command-line options'), 'stdout should contain word "where OPTIONS are zero or more command-line options"');
    });


});
