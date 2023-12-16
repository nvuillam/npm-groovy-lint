#! /usr/bin/env node
"use strict";
let assert = require("assert");
const util = require("util");
const fse = require("fs-extra");
const rimraf = require("rimraf");
const childProcess = require("child_process");
const exec = util.promisify(childProcess.exec);
const { copyFilesInTmpDir, SAMPLE_FILE_SMALL, SAMPLE_FILE_SMALL_FIX, NPM_GROOVY_LINT } = require("./helpers/common");

describe("Lint & fix with EXE", function() {
    it("(EXE:file) should lint and fix a file in one shot", async function() {
        const tmpDir = await copyFilesInTmpDir();
        try {
            const prevFileContent = fse.readFileSync(tmpDir + "/" + SAMPLE_FILE_SMALL).toString();
            const params = [
                "--output", '"npm-groovy-fix-log.json"',
                "--path", '"' + tmpDir + '"',
                "--files", '"**/' + SAMPLE_FILE_SMALL +'"',
                "--fix",
                "--no-insight",
                "--failon", "none",
                "--verbose"
            ];
            const { stdout, stderr } = await exec(NPM_GROOVY_LINT + params.join(" "));
            if (stderr) {
                console.error(stderr);
            }
            assert(stdout, "stdout is set");

            assert(fse.existsSync("npm-groovy-fix-log.json"), "Output json file has been produced");

            const newFileContent = fse.readFileSync(tmpDir + "/" + SAMPLE_FILE_SMALL).toString().replace(/\r\n/g,'\n');
            assert(prevFileContent !== newFileContent, "Groovy file has been updated");
            const expectedFileContent = fse.readFileSync(tmpDir + "/" + SAMPLE_FILE_SMALL_FIX).toString().replace(/\r\n/g,'\n');
            assert.strictEqual(newFileContent, expectedFileContent, "Formatted file is corresponding to expected result");
        }  finally {
            fse.removeSync("npm-groovy-fix-log.json");
            rimraf.sync(tmpDir);
        }
    }).timeout(120000);
});
