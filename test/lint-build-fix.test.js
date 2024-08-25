#! /usr/bin/env node
import  assert from 'assert';
import * as util from 'util';
import fs from 'fs-extra'
import * as rimraf from "rimraf";
import * as childProcess from "child_process";
const exec = util.promisify(childProcess.exec);
import { copyFilesInTmpDir, SAMPLE_FILE_SMALL, SAMPLE_FILE_SMALL_FIX, NPM_GROOVY_LINT } from "./helpers/common.js";

describe("Lint & fix with EXE", function() {
    it("(EXE:file) should lint and fix a file in one shot", async function() {
        const tmpDir = await copyFilesInTmpDir();
        try {
            const prevFileContent = fs.readFileSync(tmpDir + "/" + SAMPLE_FILE_SMALL).toString();
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

            assert(fs.existsSync("npm-groovy-fix-log.json"), "Output json file has been produced");

            const newFileContent = fs.readFileSync(tmpDir + "/" + SAMPLE_FILE_SMALL).toString().replace(/\r\n/g,'\n');
            assert(prevFileContent !== newFileContent, "Groovy file has been updated");
            const expectedFileContent = fs.readFileSync(tmpDir + "/" + SAMPLE_FILE_SMALL_FIX).toString().replace(/\r\n/g,'\n');
            assert.strictEqual(newFileContent, expectedFileContent, "Formatted file is corresponding to expected result");
        }  finally {
            fs.removeSync("npm-groovy-fix-log.json");
            rimraf.sync(tmpDir);
        }
    }).timeout(120000);
});
