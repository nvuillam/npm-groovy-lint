#! /usr/bin/env node
"use strict";
const NpmGroovyLint = require('../src/groovy-lint.js');
let assert = require('assert');

describe('TEST npm-groovy-lint with sources', function () {

    it('(SRC) should fix groovy files', async function () {
        const res = await new NpmGroovyLint([
            process.execPath,
            '',
            '--path', '"jdeploy-bundle/lib/example"',
            '--rulesets', '"jdeploy-bundle/lib/example/RuleSet-Groovy.groovy"',
            '--fix',
            '--verbose'], {
            jdeployRootPath: 'jdeploy-bundle',
        }).run();
        assert(res.status === 0 && res.fixer && res.fixer.fixedErrorsNumber > 0, 'Script failure');
    }).timeout(60000);

    it('(SRC) should fix a Jenkinsfile', async function () {
        const res = await new NpmGroovyLint([
            process.execPath,
            '',
            '--path', '"jdeploy-bundle/lib/example"',
            '--files', '**/Jenkinsfile',
            '--rulesets', '"jdeploy-bundle/lib/example/RuleSet-Groovy.groovy"',
            '--fix',
            '--verbose'], {
            jdeployRootPath: 'jdeploy-bundle',
        }).run();
        assert(res.status === 0 && res.fixer && res.fixer.fixedErrorsNumber > 0, 'Script failure');
    }).timeout(60000);

});
