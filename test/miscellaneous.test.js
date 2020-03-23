#! /usr/bin/env node
"use strict";
const NpmGroovyLint = require('../src/groovy-lint.js');
let assert = require('assert');

describe('Miscellaneous', function () {

    it('(API:source) returns config file path using config', async () => {
        const npmGroovyLintConfig = {
            path: "./lib/example/",
            files: '**/SampleFile.groovy',
            output: 'txt',
            verbose: true
        };
        const linter = await new NpmGroovyLint(
            npmGroovyLintConfig, {
            jdeployRootPath: 'jdeploy-bundle'
        }).run();
        const filePath = await linter.getConfigFilePath();
        assert(linter.status === 0, 'Linter status is 0');
        assert(filePath.includes('.groovylintrc.js'), ".groovylintrc.js has been returned")
    });

    it('(API:source) returns config file path using parameter', async () => {
        const npmGroovyLintConfig = {
        };
        const linter = new NpmGroovyLint(
            npmGroovyLintConfig, {
            jdeployRootPath: 'jdeploy-bundle'
        });
        const filePath = await linter.getConfigFilePath('./lib/example/');
        assert(linter.status === 0, 'Linter status is 0');
        assert(filePath.includes('.groovylintrc.js'), ".groovylintrc.js has been returned")
    });

});
