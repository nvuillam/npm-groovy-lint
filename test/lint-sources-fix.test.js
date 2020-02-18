#! /usr/bin/env node
"use strict";
const NpmGroovyLint = require('../src/groovy-lint.js');
let assert = require('assert');

describe('NPM GROOVY LINT with sources', () => {
    it('(SRC) should run with NGL option: --ngl-fix', async () => {
        const res = await new NpmGroovyLint({ jdeployRootPath: 'jdeploy-bundle' }, [
            process.execPath,
            '',
            '-basedir="jdeploy-bundle/lib/example"',
            '-rulesetfiles="file:jdeploy-bundle/lib/example/RuleSet-Base.groovy"',
            '--ngl-fix']).run();
        assert(res.status === 0 && res.nglOutputString.includes('warning'), 'Script failure');
    });

});
