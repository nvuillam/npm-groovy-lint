#! /usr/bin/env node
"use strict";
const NpmGroovyLint = require('../src/groovy-lint.js');
let assert = require('assert');
const fse = require("fs-extra");

describe('Format with API', function () {

    it('(API:source) should format code', async () => {
        const prevFileContent = fse.readFileSync('./lib/example/SampleFile.groovy').toString();
        const npmGroovyLintConfig = {
            source: prevFileContent,
            format: true,
            output: 'txt',
            verbose: true
        };
        const linter = await new NpmGroovyLint(
            npmGroovyLintConfig, {
            jdeployRootPath: 'jdeploy-bundle'
        }).run();

        assert(linter.status === 0, 'Status is 0');
        assert(linter.lintResult.summary.totalFixedNumber >= 972, 'Errors have been fixed');
        assert(linter.lintResult.files[0].updatedSource &&
            linter.lintResult.files[0].updatedSource !== prevFileContent,
            'Source has been updated');
        const fixedNbInLogs = (linter.outputString.match(/fixed/g) || []).length;
        assert(fixedNbInLogs >= 972, 'Result logs contain fixed errors');
        assert(!linter.outputString.includes('NaN'), 'Results does not contain NaN');

    }).timeout(200000);

});
