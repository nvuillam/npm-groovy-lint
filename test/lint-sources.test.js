#! /usr/bin/env node
"use strict";
const NpmGroovyLint = require('../src/groovy-lint.js');
let assert = require('assert');
const fse = require("fs-extra");

describe('TEST npm-groovy-lint with sources', () => {

    it('(SRC) should generate text console output', async () => {
        const res = await new NpmGroovyLint([
            process.execPath,
            '',
            '--path', '"jdeploy-bundle/lib/example"',
            '--rulesets', '"jdeploy-bundle/lib/example/RuleSet-Groovy.groovy"',
            '--verbose'
        ], {
            jdeployRootPath: 'jdeploy-bundle',
            verbose: true
        }).run();
        assert(res.status === 0 && res.nglOutputString.includes('warning'), 'Script failure');
    });

    it('(SRC) should generate json output', async () => {
        const res = await new NpmGroovyLint([
            process.execPath,
            '',
            '--path', '"jdeploy-bundle/lib/example"',
            '--rulesets', '"jdeploy-bundle/lib/example/RuleSet-Groovy.groovy"',
            '--output', 'json',
            '--loglevel', 'warning'
        ],
            { jdeployRootPath: 'jdeploy-bundle' }).run();
        assert(res.status === 0 && res.nglOutputString.includes('"totalFilesWithErrorsNumber"'), 'Script failure');
    });

    it('(SRC) should generate codenarc HTML file report', async () => {
        const res = await new NpmGroovyLint([
            process.execPath,
            '',
            '--codenarcargs',
            '-basedir="jdeploy-bundle/lib/example"',
            '-rulesetfiles="file:jdeploy-bundle/lib/example/RuleSet-Groovy.groovy"',
            '-title="TestTitleCodenarc"',
            '-maxPriority1Violations=0',
            '-report="html:ReportTestCodenarc.html"'],
            { jdeployRootPath: 'jdeploy-bundle' }).run();
        assert(res.status === 0 && fse.existsSync('ReportTestCodenarc.html'), 'Script failure');
        fse.removeSync('ReportTestCodenarc.html');
    });

    it('(SRC) should generate codenarc XML report', async () => {
        const res = await new NpmGroovyLint([
            process.execPath,
            '',
            '--codenarcargs',
            '-basedir="jdeploy-bundle/lib/example"',
            '-rulesetfiles="file:jdeploy-bundle/lib/example/RuleSet-Groovy.groovy"',
            '-title="TestTitleCodenarc"',
            '-maxPriority1Violations=0',
            '-report="xml:ReportTestCodenarc.xml"'],
            { jdeployRootPath: 'jdeploy-bundle' }).run();
        assert(res.status === 0 && fse.existsSync('ReportTestCodenarc.xml'), 'Script failure');
        fse.removeSync('ReportTestCodenarc.xml');
    });

    it('(SRC) should run on a Jenkinsfile', async () => {
        const res = await new NpmGroovyLint([
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
        assert(res.status === 0 && res.nglOutputString.includes('warning'), 'Script failure');
    });

    it('(SRC) should show npm-groovy-lint help', async () => {
        const res = await new NpmGroovyLint([
            process.execPath,
            '',
            '-h'], {
            jdeployRootPath: 'jdeploy-bundle'
        }).run();
        assert(res.status === 0 && res.nglOutputString.includes('-v, --verbose'));
    });

    it('(SRC) should show codenarc help', async () => {
        const res = await new NpmGroovyLint([
            process.execPath,
            '',
            '--codenarcargs',
            '-help'], {
            jdeployRootPath: 'jdeploy-bundle'
        }).run();
        assert(res.status === 0 && res.codeNarcStdOut.includes('where OPTIONS are zero or more command-line options'), 'Script failure');
    });
});
