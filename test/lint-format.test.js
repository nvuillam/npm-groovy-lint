#! /usr/bin/env node
"use strict";
const NpmGroovyLint = require("../lib/groovy-lint.js");
let assert = require("assert");
const fse = require("fs-extra");
const { normalizeNewLines } = require("../lib/utils.js");
const rimraf = require("rimraf");
const {
    beforeEachTestCase,
    checkCodeNarcCallsCounter,
    getDiff,
    copyFilesInTmpDir,
    SAMPLE_FILE_BIG,
    SAMPLE_FILE_BIG_PATH,
    SAMPLE_FILE_SMALL_PATH
} = require("./helpers/common");

describe("Format with API", function() {
    beforeEach(beforeEachTestCase);

    it("(API:source) should format code", async function() {
        const expectedFixedErrs = 1096;
        const prevFileContent = fse.readFileSync(SAMPLE_FILE_BIG_PATH).toString();
        const npmGroovyLintConfig = {
            source: prevFileContent,
            format: true,
            nolintafter: true,
            output: "txt",
            insight: false,
            verbose: true
        };
        const linter = await new NpmGroovyLint(npmGroovyLintConfig, {}).run();

        assert(linter.status === 1, `Linter status is 1 (${linter.status} returned)`);
        assert(
            linter.lintResult.summary.totalFixedNumber >= expectedFixedErrs,
            `${expectedFixedErrs} errors have been fixed (${linter.lintResult.summary.totalFixedNumber} returned)`
        );
        assert(linter.lintResult.files[0].updatedSource && linter.lintResult.files[0].updatedSource !== prevFileContent, "Source has been updated");
        const fixedNbInLogs = (linter.outputString.match(/fixed/g) || []).length;
        assert(fixedNbInLogs >= expectedFixedErrs, `Result log contains ${expectedFixedErrs} fixed errors (${fixedNbInLogs} returned)`);
        assert(!linter.outputString.includes("NaN"), "Results does not contain NaN");
        checkCodeNarcCallsCounter(2);
    }).timeout(100000);

    it("(API:source) should format code with custom config", async function() {
        const expectedFixedErrs = 23;
        const prevFileContent = fse.readFileSync(SAMPLE_FILE_SMALL_PATH).toString();
        const npmGroovyLintConfig = {
            source: prevFileContent,
            sourcefilepath: SAMPLE_FILE_SMALL_PATH,
            config: "custom",
            format: true,
            nolintafter: true,
            output: "txt",
            insight: false,
            verbose: true
        };
        const linter = await new NpmGroovyLint(npmGroovyLintConfig, {}).run();

        assert(linter.status === 1, `Linter status is 1 (${linter.status} returned)`);
        assert(
            linter.lintResult.summary.totalFixedNumber >= expectedFixedErrs,
            `${expectedFixedErrs} errors have been fixed (${linter.lintResult.summary.totalFixedNumber} returned)`
        );
        assert(linter.lintResult.files[0].updatedSource && linter.lintResult.files[0].updatedSource !== prevFileContent, "Source has been updated");
        const fixedNbInLogs = (linter.outputString.match(/fixed/g) || []).length;
        assert(fixedNbInLogs >= expectedFixedErrs, `Result log contains ${expectedFixedErrs} fixed errors (${fixedNbInLogs} returned)`);
        assert(!linter.outputString.includes("NaN"), "Results does not contain NaN");
        const rules = linter.options.rules || {};
        assert(rules["Indentation"]["spacesPerIndentLevel"] === 2, "Indentation rule override has been taken in account");
        checkCodeNarcCallsCounter(1);
    }).timeout(100000);

    it("(API:file) should format code", async function() {
        const expectedFixedErrs = 1096;
        const tmpDir = await copyFilesInTmpDir();
        try {
            const prevFileContent = fse.readFileSync(SAMPLE_FILE_BIG_PATH).toString();
            const npmGroovyLintConfig = {
                path: tmpDir,
                files: `**/${SAMPLE_FILE_BIG}`,
                format: true,
                nolintafter: true,
                output: "txt",
                insight: false,
                verbose: true
            };
            const linter = await new NpmGroovyLint(npmGroovyLintConfig, {}).run();

            assert(linter.status === 1, `Linter status is 1 (${linter.status} returned)`);
            assert(
                linter.lintResult.summary.totalFixedNumber >= expectedFixedErrs,
                `${expectedFixedErrs} errors have been fixed (${linter.lintResult.summary.totalFixedNumber} returned)`
            );
            const newFileContent = fse.readFileSync(tmpDir + "/" + SAMPLE_FILE_BIG).toString();
            assert(newFileContent !== prevFileContent, "File has been updated");
            const fixedNbInLogs = (linter.outputString.match(/fixed/g) || []).length;
            assert(fixedNbInLogs >= expectedFixedErrs, `Result log contains ${expectedFixedErrs} fixed errors (${fixedNbInLogs} returned)`);
            assert(!linter.outputString.includes("NaN"), "Results does not contain NaN");
            checkCodeNarcCallsCounter(2);
        } finally {
            rimraf.sync(tmpDir);
        }
    }).timeout(100000);

    for (const [key, val] of getSamplesMap()) {
        it("(API:source) " + key + " --format", async function() {
            await checkRule(key, val, "format");
        }).timeout(30000);
        it("(API:source) " + key + " --fix", async function() {
            await checkRule(key, val, "fix");
        }).timeout(30000);
    }
});

async function checkRule(key, check, checkType) {
    const source = normalizeNewLines(check.before);
    const moreOptions = check.moreOptions ? check.moreOptions : {};
    const npmGroovyLintConfig = Object.assign(
        {
            source: source,
            nolintafter: true,
            output: "none",
            failon: "none",
            insight: false,
            verbose: true
        },
        moreOptions
    );
    if (checkType == "format") {
        npmGroovyLintConfig.format = true;
    } else if (checkType == "fix") {
        npmGroovyLintConfig.fix = true;
    }
    const linter = await new NpmGroovyLint(npmGroovyLintConfig, {}).run();

    assert(
        linter.lintResult.summary.totalFixedNumber >= check.totalFixed,
        `${check.totalFixed} Errors have been fixed (${linter.lintResult.summary.totalFixedNumber} returned)`
    );
    const result = linter.lintResult.files[0].updatedSource;
    const expectedResult = normalizeNewLines(check.after);
    const effectiveDiff = getDiff(expectedResult, result, source);
    assert(linter.status === 0, `Linter status is 0 (${linter.status} returned)`);
    assert(effectiveDiff.length === 0, "Code has been formatted correctly");
    checkCodeNarcCallsCounter(check.codeNarcCallsCounter);
}

function getSamplesMap() {
    return new Map([
        [
            "SourceWithIfElseBracesToFormat",
            {
                totalFixed: 4,
                codeNarcCallsCounter: 2,
                before: `
private void doSomething(){
            if (a == 2)
                doSomething();
}
`,
                after: `
private void doSomething() {
    if (a == 2) {
        doSomething()
    }
}
`
            }
        ],
        [
            "OnlyNonCodeNarcFormatRules",
            {
                totalFixed: 0,
                codeNarcCallsCounter: 1,
                before: `
    // There is a comment badly aligned here
if (a == 2) {
            // And here too
    x = 1
    }
`,
                after: `
// There is a comment badly aligned here
if (a == 2) {
    // And here too
    x = 1
}
`
            }
        ],
        [
            "OverrideIndentation",
            {
                moreOptions: {
                    rulesets:
                        'Indentation{"spacesPerIndentLevel":2,"severity": "warning"},UnnecessarySemicolon,UnnecessaryGString,ConsecutiveBlankLines{"severity":"warning"},NoTabCharacter',
                    rulesetsoverridetype: "appendConfig"
                },
                totalFixed: 4,
                codeNarcCallsCounter: 2,
                before: `
private void doSomething(){
            if (a == 2)
                doSomething();
}
`,
                after: `
private void doSomething() {
  if (a == 2) {
    doSomething()
  }
}
`
            }
        ],
        [
            "ElseIfMustRemainSeparated",
            {
                totalFixed: 1,
                codeNarcCallsCounter: 1,
                before: `
boolean foo(boolean a, boolean b) {
    if (a) {
        return true
    } else if(b) {
        return true
    }
}
`,
                after: `
boolean foo(boolean a, boolean b) {
    if (a) {
        return true
    } else if (b) {
        return true
    }
}
`
            }
        ],
        // https://github.com/nvuillam/npm-groovy-lint/issues/121
        [
            "Issue121",
            {
                totalFixed: 1,
                codeNarcCallsCounter: 1,
                before: `
pipeline {
agent any
        stages {
            stage('Intall JQ') {
            steps {
            script {
                sh 'apt update; apt install jq=1.5+dfsg-2+b1 -y'
            }
            }
            }
        }
    }
`,
                after: `
pipeline {
    agent any
        stages {
            stage('Intall JQ') {
            steps {
                script {
                    sh 'apt update; apt install jq=1.5+dfsg-2+b1 -y'
                }
            }
            }
        }
}
`
                /* TODO: update CodeNarc or Groovy so that the good "after" can be uncommented !
                after: `
                pipeline {
                    agent any
                    stages {
                        stage('Intall JQ') {
                            steps {
                                script {
                                    sh 'apt update; apt install jq=1.5+dfsg-2+b1 -y'
                                }
                            }
                        }
                    }
                }
                ` */
            }
        ]
    ]);
}
