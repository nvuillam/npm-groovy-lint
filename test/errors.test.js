#! /usr/bin/env node
"use strict";
const NpmGroovyLint = require('../src/groovy-lint.js');
let assert = require('assert');
const fse = require("fs-extra");

const { SAMPLE_FILE_SMALL_PATH } = require('./helpers/common');

describe('Errors', function () {

    it('(API:source) should trigger a parse options error', async () => {
        const prevFileContent = fse.readFileSync('./lib/example/SampleFile.groovy').toString();
        const npmGroovyLintConfig = {
            source: prevFileContent,
            insight: false,
            someUnknownParam: "lelamanul"
        };
        let errRes;
        try {
            await new NpmGroovyLint(
                npmGroovyLintConfig, {
                jdeployRootPath: 'jdeploy-bundle'
            }).run();
        } catch (e) {
            errRes = e;
        }
        assert(errRes != null, 'Error has been triggered');
        assert(errRes.message.includes('Invalid option'), 'Invalid option detected');
    });

    it('(API:source) should trigger a codenarc error', async () => {
        const npmGroovyLintConfig = {
            path: '/not/existing/path',
            insight: false,
            output: 'txt',
            verbose: true
        };
        const linter = await new NpmGroovyLint(
            npmGroovyLintConfig, {
            jdeployRootPath: 'jdeploy-bundle'
        }).run();

        assert(linter.status > 0, 'Linter status is > 0');
        assert(linter.codeNarcStdErr && linter.codeNarcStdErr.includes('java.io.FileNotFoundException'), 'FileNotFoundException returned by CodeNarc');
    });

    it('(API:source) should trigger a codenarc error (--noserver)', async () => {
        const npmGroovyLintConfig = {
            path: '/not/existing/path',
            insight: false,
            noserver: true
        };
        const linter = await new NpmGroovyLint(
            npmGroovyLintConfig, {
            jdeployRootPath: 'jdeploy-bundle'
        }).run();

        assert(linter.status > 0, 'Linter status is > 0');
        assert(linter.codeNarcStdErr && linter.codeNarcStdErr.includes('java.io.FileNotFoundException'), 'FileNotFoundException returned by CodeNarc');
    });

    it('(API:source) should trigger a fix function error', async () => {
        const prevFileContent = fse.readFileSync(SAMPLE_FILE_SMALL_PATH).toString();
        const npmGroovyLintConfig = {
            source: prevFileContent,
            fix: true,
            fixrules: "TriggerTestError",
            insight: false,
            output: 'txt',
            verbose: true
        };
        const linter = await new NpmGroovyLint(
            npmGroovyLintConfig, {
            jdeployRootPath: 'jdeploy-bundle'
        }).run();

        assert(linter.status === 0, `Linter status is 0 (${linter.status} returned)`);
    });

});
