#! /usr/bin/env node
"use strict";
const util = require("util");
let assert = require('assert');
const fse = require("fs-extra");

const exec = util.promisify(require("child_process").exec);

describe('NPM GROOVY LINT with jdeploy-bundle', () => {
    it('should run with NGL option: --ngl-output=text', async () => {
        const params = [
            '-basedir="jdeploy-bundle/lib/example"',
            '-rulesetfiles="file:jdeploy-bundle/lib/example/RuleSet-Base.groovy"',
            '-title="TestTitle"',
            '-maxPriority1Violations=0',
            '-report="html:toBeIgnoredAtRuntime.xxx"',
            '--ngl-output=text'];
        const { stdout } = await exec('npm-groovy-lint ' + params.join(' '));
        assert(stdout && stdout.includes('warning'), 'Script failure');
    });
    it('should run with NGL option: --ngl-output=json', async () => {
        const params = [
            '-basedir="jdeploy-bundle/lib/example"',
            '-rulesetfiles="file:jdeploy-bundle/lib/example/RuleSet-Base.groovy"',
            '-title="TestTitle"',
            '-maxPriority1Violations=0',
            '-report="html:toBeIgnoredAtRuntime.zzz"',
            '--ngl-output=json'];
        const { stdout } = await exec('npm-groovy-lint ' + params.join(' '));
        assert(stdout && stdout.includes('{"files":{'), 'Script failure');
    });

    it('should run with only codenarc options: HTML', async () => {
        const params = [
            '-basedir="jdeploy-bundle/lib/example"',
            '-rulesetfiles="file:jdeploy-bundle/lib/example/RuleSet-Base.groovy"',
            '-title="TestTitleCodenarc"',
            '-maxPriority1Violations=0',
            '-report="html:ReportTestCodenarc.html"'];
        await exec('npm-groovy-lint ' + params.join(' '));
        assert(fse.existsSync('ReportTestCodenarc.html'), 'Script failure');
        fse.removeSync('ReportTestCodenarc.html');
    });

    it('should run with only codenarc options: XML', async () => {
        const params = [
            '-basedir="jdeploy-bundle/lib/example"',
            '-rulesetfiles="file:jdeploy-bundle/lib/example/RuleSet-Base.groovy"',
            '-title="TestTitleCodenarc"',
            '-maxPriority1Violations=0',
            '-report="xml:ReportTestCodenarc.xml"'];
        await exec('npm-groovy-lint ' + params.join(' '));
        assert(fse.existsSync('ReportTestCodenarc.xml'), 'Script failure');
        fse.removeSync('ReportTestCodenarc.xml');
    });

    it('should run with only codenarc options: HELP', async () => {
        const params = [
            '-help'
        ];
        const { stdout } = await exec('npm-groovy-lint ' + params.join(' '));
        assert(stdout.includes('where OPTIONS are zero or more command-line options'), 'Script failure');
    });
});
