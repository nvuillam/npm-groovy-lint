#! /usr/bin/env node
"use strict";
const util = require("util");
let assert = require('assert');
const fse = require("fs-extra");

const exec = util.promisify(require("child_process").exec);

describe('TEST npm-groovy-lint with built jdeploy-bundle', () => {
    it('(EXE) should generate text console output', async () => {
        const params = [
            '--path', '"jdeploy-bundle/lib/example"',
            '--rulesets', '"jdeploy-bundle/lib/example/RuleSet-Groovy.groovy"',
            '--verbose'
        ];
        const { stdout } = await exec('npm-groovy-lint ' + params.join(' '));
        assert(stdout && stdout.includes('info'), 'Script failure');
    });
    it('(EXE) should generate json console output', async () => {
        const params = [
            '--path', '"jdeploy-bundle/lib/example"',
            '--rulesets', '"jdeploy-bundle/lib/example/RuleSet-Groovy.groovy"',
            '--output', 'json'
        ];
        const { stdout } = await exec('npm-groovy-lint ' + params.join(' '));
        assert(stdout && stdout.includes('"totalFilesWithErrorsNumber"'), 'Script failure');
    });

    it('(EXE) should generate codenarc HTML file report', async () => {
        const params = [
            '--codenarcargs',
            '-basedir="jdeploy-bundle/lib/example"',
            '-rulesetfiles="file:jdeploy-bundle/lib/example/RuleSet-Groovy.groovy"',
            '-title="TestTitleCodenarc"',
            '-maxPriority1Violations=0',
            '-report="html:ReportTestCodenarc.html"'];
        await exec('npm-groovy-lint ' + params.join(' '));
        assert(fse.existsSync('ReportTestCodenarc.html'), 'Script failure');
        fse.removeSync('ReportTestCodenarc.html');
    });

    it('(EXE) should generate codenarc XML file report', async () => {
        const params = [
            '--codenarcargs',
            '-basedir="jdeploy-bundle/lib/example"',
            '-rulesetfiles="file:jdeploy-bundle/lib/example/RuleSet-Groovy.groovy"',
            '-title="TestTitleCodenarc"',
            '-maxPriority1Violations=0',
            '-report="xml:ReportTestCodenarc.xml"'];
        await exec('npm-groovy-lint ' + params.join(' '));
        assert(fse.existsSync('ReportTestCodenarc.xml'), 'Script failure');
        //       fse.removeSync('ReportTestCodenarc.xml');
    });

    it('(EXE) should run on a Jenkinsfile', async () => {
        const params = [
            '--path', ' "jdeploy-bundle/lib/example"',
            '--f', '"**/Jenkinsfile"',
            '-r', '"jdeploy-bundle/lib/example/RuleSet-Jenkinsfile.groovy"',
            '--verbose'];
        const { stdout } = await exec('npm-groovy-lint ' + params.join(' '));
        assert(stdout && stdout.includes('warning'), 'Script failure');
    });

    it('(EXE) should show npm-groovy-lint help', async () => {
        const params = [
            '-h'
        ];
        const { stdout } = await exec('npm-groovy-lint ' + params.join(' '));
        assert(stdout.includes('-v, --verbose'), 'Script failure');
    });

    it('(EXE) should show codenarc help', async () => {
        const params = [
            '--codenarcargs',
            '-help'
        ];
        const { stdout } = await exec('npm-groovy-lint ' + params.join(' '));
        assert(stdout.includes('where OPTIONS are zero or more command-line options'), 'Script failure');
    });
});
