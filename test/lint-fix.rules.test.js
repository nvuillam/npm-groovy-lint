#! /usr/bin/env node
"use strict";
const NpmGroovyLint = require('../src/groovy-lint.js');
const { getNpmGroovyLintRules } = require("../src/groovy-lint-rules.js");
let assert = require('assert');

const { beforeEachTestCase, checkCodeNarcCallsCounter, getDiff } = require('./helpers/common');
const npmGroovyLintRules = getNpmGroovyLintRules({ loadTests: true });

// Read rules file and test all fixes
describe('Check rules auto-fixes', () => {
    beforeEach(beforeEachTestCase);

    // Iterate all rules
    for (const ruleName of Object.keys(npmGroovyLintRules)) {
        let pos = 1;
        // Process only the rules with a fix defined
        if (npmGroovyLintRules[ruleName].fix && npmGroovyLintRules[ruleName]) {
            if (npmGroovyLintRules[ruleName].tests && npmGroovyLintRules[ruleName].tests.length > 0) {
                // Process rule tests
                for (const testRule of npmGroovyLintRules[ruleName].tests) {
                    // Do not test non-codenarc rules, as they can't be returned by CodeNarc Linter
                    if (npmGroovyLintRules[ruleName].isCodeNarcRule == null || npmGroovyLintRules[ruleName].isCodeNarcRule === true)
                        it(`${ruleName} (${pos})`, async () => {
                            await checkRuleFix(ruleName, testRule);
                        }).timeout(60000);
                    pos = pos + 1;
                }
            }
            else {
                // At least one rule should be defined
                it(`${ruleName} fix tests has not been defined: please do it !`, async () => {
                    assert(0 === 1, `${ruleName} fix tests has not been defined: please do it !`)
                })
            }
        }

    }
});

// Check rule fix result
async function checkRuleFix(ruleName, testRule) {
    let fixRules = ruleName;
    // Call linter & fixer
    const source = testRule.sourceBefore.replace(/\r?\n/g, "\r\n");
    const npmGroovyLintConfig = {
        source: source,
        rulesets: fixRules,
        fix: true,
        fixrules: fixRules,
        nolintafter: true,
        output: 'none',
        verbose: true
    };
    let err = null;
    let linter;
    try {
        linter = await new NpmGroovyLint(
            npmGroovyLintConfig, {
            jdeployRootPath: 'jdeploy-bundle'
        }).run();
    } catch (e) {
        console.error('NpmGroovyLint fatal error: ' + e.message);
        console.error(e.stack);
        err = e;
    }
    // Check results
    assert(err == null, "No crash during NpmGroovyLint run");
    assert(linter.status === 0, 'Linter status is 0');
    assert(linter.lintResult.summary.totalFixedNumber > 0, 'Errors have been fixed');
    const updatedSource = linter.lintResult.files[0].updatedSource;
    const effectiveDiffs = getDiff(testRule.sourceAfter, updatedSource, source);
    assert(effectiveDiffs.length === 0, `Fix result is not the one expected.\n Diff: \n${JSON.stringify(effectiveDiffs, null, 2)}`);
    checkCodeNarcCallsCounter(testRule.codeNarcCallsNumber || 1);
}



