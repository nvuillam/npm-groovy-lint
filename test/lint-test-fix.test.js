#! /usr/bin/env node
"use strict";
const NpmGroovyLint = require('../src/groovy-lint.js');
let assert = require('assert');
const fse = require("fs-extra");

describe('TEST npm-groovy-lint fixes with sources', function () {

    it('(SRC) should fix groovy files', async function () {
        const res = await new NpmGroovyLint([
            process.execPath,
            '',
            '--path', '"jdeploy-bundle/lib/example"',
            '--output', '"npm-groovy-fix-log.txt"',
            '--rulesets', 'Groovy',
            '--fix',
            '--verbose'], {
            jdeployRootPath: 'jdeploy-bundle',
        }).run();
        assert(res.status === 0 && res.fixer && res.fixer.fixedErrorsNumber > 0, 'Script failure');
        assert(fse.existsSync('npm-groovy-fix-log.txt'), 'Output txt file not found')
        //fse.removeSync('npm-groovy-fix-log.txt');
    }).timeout(60000);

    it('(SRC) should fix a Jenkinsfile', async function () {
        const res = await new NpmGroovyLint([
            process.execPath,
            '',
            '--output', '"npm-groovy-fix-log.json"',
            '--path', '"jdeploy-bundle/lib/example"',
            '--rulesets', 'Jenkinsfile',
            '--fix',
            '--verbose'], {
            jdeployRootPath: 'jdeploy-bundle',
        }).run();
        assert(res.status === 0 && res.fixer && res.fixer.fixedErrorsNumber > 0, 'Script failure');
        assert(fse.existsSync('npm-groovy-fix-log.json'), 'Output json file not found');
        fse.removeSync('npm-groovy-fix-log.json');
    }).timeout(60000);

});
