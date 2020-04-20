#! /usr/bin/env node
"use strict";
const NpmGroovyLint = require('../src/groovy-lint.js');
let assert = require("assert");
const path = require("path");
const { beforeEachTestCase,
    checkCodeNarcCallsCounter,
    SAMPLE_FILE_BIG,
    SAMPLE_FILE_SMALL
} = require('./helpers/common');

describe('Miscellaneous', function () {
    beforeEach(beforeEachTestCase);

    it('(API:source) returns config file path using config', async () => {
        const npmGroovyLintConfig = {
            path: "./lib/example/",
            files: '**/' + SAMPLE_FILE_SMALL,
            output: 'txt',
            verbose: true
        };
        const linter = await new NpmGroovyLint(
            npmGroovyLintConfig, {
            jdeployRootPath: 'jdeploy-bundle'
        }).run();
        const filePath = await linter.getConfigFilePath();
        assert(linter.status === 0, 'Linter status is 0');
        assert(path.resolve(filePath) === path.resolve('./lib/example/.groovylintrc.json'), ".groovylintrc.json has been returned")
    });

    it('(API:source) returns config file path using parameter', async () => {
        const npmGroovyLintConfig = {
        };
        const linter = new NpmGroovyLint(
            npmGroovyLintConfig, {
            jdeployRootPath: 'jdeploy-bundle'
        });
        const filePath = await linter.getConfigFilePath('./lib/example');
        assert(linter.status === 0, 'Linter status is 0');
        assert(path.resolve(filePath) === path.resolve('./lib/example/.groovylintrc.json'), ".groovylintrc.json has been returned")
    });


    it('(API:source) return rules', async () => {
        const npmGroovyLintConfig = {
            path: "./lib/example/",
            files: '**/' + SAMPLE_FILE_SMALL,
            returnrules: true,
            output: 'none'
        };
        const linter = await new NpmGroovyLint(
            npmGroovyLintConfig, {
            jdeployRootPath: 'jdeploy-bundle'
        }).run();
        assert(linter.status === 0, 'Linter status is 0');
        assert(linter.lintResult.rules != null, "Rules are returned ");
        assert(linter.lintResult.rules['AssertWithinFinallyBlock'].docUrl != null, "Rules doc urls are returned ");
    });

    it('(API:source) do not return rules', async () => {
        const npmGroovyLintConfig = {
            path: "./lib/example/",
            files: '**/' + SAMPLE_FILE_SMALL,
            output: 'none'
        };
        const linter = await new NpmGroovyLint(
            npmGroovyLintConfig, {
            jdeployRootPath: 'jdeploy-bundle'
        }).run();
        assert(linter.status === 0, 'Linter status is 0');
        assert(linter.lintResult.rules == null, "Rules are not returned");
    });



    it('(API:source) should cancel current request', async () => {
        const requestKey = 'requestKeyCalculatedByExternal' + Math.random()
        const npmGroovyLintConfig = {
            path: "./lib/example/",
            files: '**/' + SAMPLE_FILE_BIG,
            output: 'none'
        };
        const linter1 = new NpmGroovyLint(
            npmGroovyLintConfig, {
            jdeployRootPath: 'jdeploy-bundle',
            requestKey: requestKey
        });
        linter1.run();
        await sleepPromise(1000);
        const linter2 = new NpmGroovyLint(
            npmGroovyLintConfig, {
            jdeployRootPath: 'jdeploy-bundle',
            requestKey: requestKey
        });
        linter2.run();
        await sleepPromise(1000);
        const linter3 = new NpmGroovyLint(
            npmGroovyLintConfig, {
            jdeployRootPath: 'jdeploy-bundle',
            requestKey: requestKey
        });
        linter3.run();
        await sleepPromise(1000);
        const linter4 = new NpmGroovyLint(
            npmGroovyLintConfig, {
            jdeployRootPath: 'jdeploy-bundle',
            requestKey: requestKey
        });
        linter4.run();
        await sleepPromise(1000);
        const linter5 = new NpmGroovyLint(
            npmGroovyLintConfig, {
            jdeployRootPath: 'jdeploy-bundle',
            requestKey: requestKey
        });
        linter5.run();
        await sleepPromise(1000);
        const linter6 = new NpmGroovyLint(
            npmGroovyLintConfig, {
            jdeployRootPath: 'jdeploy-bundle',
            requestKey: requestKey
        });
        linter6.run();
        await sleepPromise(1000);
        const linterLast = await new NpmGroovyLint(
            npmGroovyLintConfig, {
            jdeployRootPath: 'jdeploy-bundle',
            requestKey: requestKey
        }).run();

        assert(linter1.status === 9, `Linter 1 status is 9 (returned ${linter1.status}`);
        assert(linter2.status === 9, `Linter 2 status is 9 (returned ${linter2.status}`);
        assert(linter3.status === 9, `Linter 3 status is 9 (returned ${linter3.status}`);
        assert(linter4.status === 9, `Linter 4 status is 9 (returned ${linter4.status}`);
        assert(linter5.status === 9, `Linter 5 status is 9 (returned ${linter5.status}`);
        assert(linter6.status === 9, `Linter 6 status is 9 (returned ${linter6.status}`);
        assert(linterLast.status === 0, `LinterLast status = 0 (returned ${linterLast.status}`);
    });

    it('(API:help) should show npm-groovy-lint help', async () => {
        const linter = await new NpmGroovyLint([
            process.execPath,
            '',
            '-h'], {
            jdeployRootPath: 'jdeploy-bundle'
        }).run();
        assert(linter.status === 0, 'Status is 0');
        assert(linter.outputString.includes('--verbose'), '--verbose is found in output text');
    });


    it('(API:help) should show npm-groovy-lint help option', async () => {
        const linter = await new NpmGroovyLint([
            process.execPath,
            '',
            '-h', 'source'], {
            jdeployRootPath: 'jdeploy-bundle'
        }).run();
        assert(linter.status === 0, 'Status is 0');
        assert(linter.outputString.includes('-s, --source'), 'npm-groovy-lint Help is displayed');
    });

    it('(API:help) should show npm-groovy-lint version', async () => {
        process.env.npm_package_version = ""; // NV: Do nto use npm_package_version to have more code coverage :)
        const linter = await new NpmGroovyLint([
            process.execPath,
            '',
            '-v'], {
            jdeployRootPath: 'jdeploy-bundle'
        }).run();
        assert(linter.status === 0, 'Status is 0');
        const FindPackageJson = require("find-package-json");
        const finder = FindPackageJson(__dirname);
        const v = finder.next().value.version;
        assert(linter.outputString.includes(`npm-groovy-lint version ${v}`), `Provides version ${v}\nReturned outputString:\n${linter.outputString}`);
        assert(linter.outputString.includes(`CodeNarc version`), `Provides CodeNarc version\nReturned outputString:\n${linter.outputString}`);
        assert(linter.outputString.includes(`Groovy version`), `Provides CodeNarc version\nReturned outputString:\n${linter.outputString}`);
    });

    it('(API:help) should show codenarc help', async () => {
        const linter = await new NpmGroovyLint([
            process.execPath,
            '',
            '--codenarcargs',
            '-help'], {
            jdeployRootPath: 'jdeploy-bundle'
        }).run();
        assert(linter.status === 0, 'Status is 0');
        assert(linter.codeNarcStdOut.includes('where OPTIONS are zero or more command-line options'), 'CodeNarc help is displayed');
        checkCodeNarcCallsCounter(1);
    });

    it('(API:Server) should kill running server', async () => {
        const linter = await new NpmGroovyLint([
            process.execPath,
            '',
            '--killserver',
            '--verbose'
        ], {
            jdeployRootPath: 'jdeploy-bundle',
            verbose: true
        }).run();

        assert(linter.status === 0, 'Status is 0');
        assert(linter.outputString.includes('CodeNarcServer terminated'), 'CodeNarcServer has been terminated');
        checkCodeNarcCallsCounter(1);
    });

    it('(API:Server) should not succeed to kill running server', async () => {
        const linter = await new NpmGroovyLint([
            process.execPath,
            '',
            '--killserver',
            '--verbose'
        ], {
            jdeployRootPath: 'jdeploy-bundle',
            verbose: true
        }).run();
        assert(linter.status === 0, 'Status is 0');
        assert(linter.outputString.includes('CodeNarcServer was not running'), 'CodeNarcServer not killed because not running');
        checkCodeNarcCallsCounter(1);
    });

});

function sleepPromise(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}