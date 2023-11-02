#! /usr/bin/env node
"use strict";
const NpmGroovyLint = require("../lib/groovy-lint.js");
const { getNpmGroovyLintRules } = require("../lib/groovy-lint-rules.js");
const { normalizeNewLines } = require("../lib/utils.js");
let assert = require("assert");

const { beforeEachTestCase, checkCodeNarcCallsCounter } = require("./helpers/common");
const npmGroovyLintRules = getNpmGroovyLintRules({ loadTests: true });

// Read rules file and test all fixes
describe("Check range detection", () => {
    beforeEach(beforeEachTestCase);

    // Iterate all rules
    for (const ruleName of Object.keys(npmGroovyLintRules)) {
        let pos = 1;
        // Process only the rules with a fix defined
        if (npmGroovyLintRules[ruleName].rangeTests && npmGroovyLintRules[ruleName]) {
            if (npmGroovyLintRules[ruleName].rangeTests && npmGroovyLintRules[ruleName].rangeTests.length > 0) {
                // Process rule tests
                for (const testRule of npmGroovyLintRules[ruleName].rangeTests) {
                    // Do not test non-codenarc rules, as they can't be returned by CodeNarc Linter
                    if (npmGroovyLintRules[ruleName].isCodeNarcRule == null || npmGroovyLintRules[ruleName].isCodeNarcRule === true)
                        it(`${ruleName} (${pos})`, async function() {
                            await checkRuleRange(ruleName, testRule);
                        }).timeout(60000);
                    pos = pos + 1;
                }
            } else {
                // At least one rule should be defined
                it(`${ruleName} range tests has not been defined: please do it !`, async function() {
                    assert(0 === 1, `${ruleName} range tests has not been defined: please do it !`);
                });
            }
        }
    }
});

// Check rule has a correct range detection
async function checkRuleRange(ruleName, testRule) {
    // Call linter & fixer
    const source = normalizeNewLines(testRule.source);
    const npmGroovyLintConfig = {
        source: source,
        rulesets: ruleName,
        nolintafter: true,
        insight: false,
        verbose: true
    };
    let err = null;
    let linter;
    try {
        linter = await new NpmGroovyLint(npmGroovyLintConfig, {}).run();
    } catch (e) {
        console.error("NpmGroovyLint fatal error: " + e.message);
        console.error(e.stack);
        err = e;
    }
    // Check results
    assert(err == null, "No crash during NpmGroovyLint run");
    assert(linter.status === 1, `Linter status is 1 (${linter.status} returned)`);
    const identifiedRange = linter.lintResult.files[0].errors[0].range;
    assert(JSON.stringify(identifiedRange) === JSON.stringify(testRule.expectedRange), `Range result is not the one expected.\nExpected:\n${JSON.stringify(testRule.expectedRange)}\nResult:\n${identifiedRange}`);
    checkCodeNarcCallsCounter(testRule.codeNarcCallsNumber || 1);
}
