#! /usr/bin/env node
"use strict";
const NpmGroovyLint = require('../src/groovy-lint.js');
let assert = require('assert');
const fse = require("fs-extra");

describe('NPM GROOVY LINT with sources', () => {
    it('(SRC) should run with NGL option: --ngl-output=text', async () => {
        const res = await new NpmGroovyLint({ jdeployRootPath: 'jdeploy-bundle' }, [
            process.execPath,
            '',
            '-basedir="jdeploy-bundle/lib/example"',
            '-rulesetfiles="file:jdeploy-bundle/lib/example/RuleSet-Base.groovy"',
            '-title="TestTitle"',
            '-maxPriority1Violations=0',
            '-report="html:toBeIgnoredAtRuntime.xxx"',
            '--ngl-output=text']).run();
        assert(res.status === 0 && res.nglOutputString.includes('warning'), 'Script failure');
    });

    it('(SRC) should run with NGL option: --ngl-output=json', async () => {
        const res = await new NpmGroovyLint({ jdeployRootPath: 'jdeploy-bundle' }, [
            process.execPath,
            '',
            '-basedir="jdeploy-bundle/lib/example"',
            '-rulesetfiles="file:jdeploy-bundle/lib/example/RuleSet-Base.groovy"',
            '-title="TestTitle"',
            '-maxPriority1Violations=0',
            '-report="html:toBeIgnoredAtRuntime.zzz"',
            '--ngl-output=json']).run();
        assert(res.status === 0 && res.nglOutputString.includes('{"files":{'), 'Script failure');
    });

    it('(SRC) should run with only codenarc options: HTML', async () => {
        const res = await new NpmGroovyLint({ jdeployRootPath: 'jdeploy-bundle' }, [
            process.execPath,
            '',
            '-basedir="jdeploy-bundle/lib/example"',
            '-rulesetfiles="file:jdeploy-bundle/lib/example/RuleSet-Base.groovy"',
            '-title="TestTitleCodenarc"',
            '-maxPriority1Violations=0',
            '-report="html:ReportTestCodenarc.html"']).run();
        assert(res.status === 0 && fse.existsSync('ReportTestCodenarc.html'), 'Script failure');
        fse.removeSync('ReportTestCodenarc.html');
    });

    it('(SRC) should run with only codenarc options: XML', async () => {
        const res = await new NpmGroovyLint({ jdeployRootPath: 'jdeploy-bundle' }, [
            process.execPath,
            '',
            '-basedir="jdeploy-bundle/lib/example"',
            '-rulesetfiles="file:jdeploy-bundle/lib/example/RuleSet-Base.groovy"',
            '-title="TestTitleCodenarc"',
            '-maxPriority1Violations=0',
            '-report="xml:ReportTestCodenarc.xml"']).run();
        assert(res.status === 0 && fse.existsSync('ReportTestCodenarc.xml'), 'Script failure');
        fse.removeSync('ReportTestCodenarc.xml');
    });

    it('(SRC) should run with only codenarc options: HELP', async () => {
        const res = await new NpmGroovyLint({ jdeployRootPath: 'jdeploy-bundle' }, [
            process.execPath,
            '',
            '-help']).run();
        assert(res.status === 0 && res.codeNarcStdOut.includes('where OPTIONS are zero or more command-line options'), 'Script failure');
    });

});
