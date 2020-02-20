#! /usr/bin/env node
"use strict";
const NpmGroovyLint = require('../src/groovy-lint.js');
let assert = require('assert');

describe('TEST npm-groovy-lint with sources', function () {

    it('(SRC) should run with NGL option: --ngl-fix', async function () {
        const res = await new NpmGroovyLint(
            {
                jdeployRootPath: 'jdeploy-bundle',
                verbose: true
            }, [
            process.execPath,
            '',
            '-basedir="jdeploy-bundle/lib/example"',
            '-rulesetfiles="file:jdeploy-bundle/lib/example/RuleSet-Groovy.groovy"',
            '--ngl-fix']).run();
        assert(res.status === 0 && res.fixer && res.fixer.fixedErrorsNumber > 0, 'Script failure');
    }).timeout(60000);

    it('(SRC) should run with NGL option: --ngl-fix on a Jenkinsfile', async function () {
        const res = await new NpmGroovyLint(
            {
                jdeployRootPath: 'jdeploy-bundle',
                verbose: true
            }, [
            process.execPath,
            '',
            '-basedir="jdeploy-bundle/lib/example"',
            '-includes=**/Jenkinsfile',
            '-rulesetfiles="file:jdeploy-bundle/lib/example/RuleSet-Groovy.groovy"',
            '--ngl-fix']).run();
        assert(res.status === 0 && res.fixer && res.fixer.fixedErrorsNumber > 0, 'Script failure');
    }).timeout(60000);

});
