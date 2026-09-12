#! /usr/bin / env node
import NpmGroovyLint from "../lib/groovy-lint.js";
import assert from "assert";
import { beforeEachTestCase, checkCodeNarcCallsCounter } from "./helpers/common.js";

describe("Check disabled rules", function () {
    beforeEach(beforeEachTestCase);

    for (const [key, val] of getSamplesMap()) {
        it("(API:source)" + key, async function () {
            await checkRule(key, val);
        }).timeout(30000);
    }
});

// These samples are about the groovylint-disable comments, not about which rules a preset
// happens to carry: pin the ruleset so the expected counts stay meaningful when the presets
// change. `recommended` reports likely mistakes only, so it would find nothing here.
const DISABLE_COMMENT_RULES = "Indentation,UnnecessarySemicolon,IfStatementBraces,UnusedVariable";

async function checkRule(key, check) {
    const npmGroovyLintConfig = {
        source: check.source,
        output: "txt",
        failon: "none",
        insight: false,
        rulesets: DISABLE_COMMENT_RULES,
        verbose: true,
    };
    const linter = await new NpmGroovyLint(npmGroovyLintConfig, {}).run();

    assert(linter.status === 0, `Linter status is 0 (${linter.status} returned)`);
    assert(
        linter.lintResult.summary.totalFoundNumber === check.totalFound,
        `${linter.lintResult.summary.totalFoundNumber} errors found (expected: ${check.totalFound})`,
    );
    checkCodeNarcCallsCounter(1);
}

function getSamplesMap() {
    return new Map([
        [
            "GroovyDisableFileAll/*",
            {
                totalFound: 0,
                source: `
/* groovylint-disable */
private void doSomething(){
            if (a == 2)
                doSomething();
   }
`,
            },
        ],
        [
            "GroovyDisableFileAll//",
            {
                totalFound: 0,
                source: `
// groovylint-disable
private void doSomething(){
            if (a == 2)
                doSomething();
   }
`,
            },
        ],
        [
            "GroovyDisableFileIndentation/*",
            {
                totalFound: 2,
                source: `
/* groovylint-disable Indentation */
private void doSomething(){
            if (a == 2)
                doSomething();
   }
`,
            },
        ],
        [
            "GroovyDisableFileIndentation//",
            {
                totalFound: 2,
                source: `
// groovylint-disable Indentation
private void doSomething(){
            if (a == 2)
                doSomething();
   }
`,
            },
        ],
        [
            "GroovyDisableFileIndentationUnnecessarySemicolon",
            {
                totalFound: 1,
                source: `
// groovylint-disable Indentation,UnnecessarySemicolon
private void doSomething(){
            if (a == 2)
                doSomething();
   }
`,
            },
        ],
        [
            "GroovyDisableLineAll",
            {
                totalFound: 2,
                source: `
private void doSomething(){
            if (a == 2)
                doSomething(); // groovylint-disable-line
   }
`,
            },
        ],
        [
            "GroovyDisableLineUnnecessarySemicolon",
            {
                totalFound: 2,
                source: `
private void doSomething(){
            if (a == 2)
                doSomething(); // groovylint-disable-line UnnecessarySemicolon
   }
`,
            },
        ],
        [
            "GroovyDisableNextLineUnnecessarySemicolon",
            {
                totalFound: 2,
                source: `
private void doSomething(){
            if (a == 2)
                // groovylint-disable-next-line UnnecessarySemicolon
                doSomething();
   }
`,
            },
        ],
        [
            "GroovyDisableNextLineToIgnore",
            {
                totalFound: 3,
                source: `
private void doSomething(){
            if (a == 2)
                // groovylint-disable-next-line DummyRule
                doSomething();
   }
`,
            },
        ],
        [
            "GroovyDisableEnableAll",
            {
                totalFound: 2,
                source: `
private void doSomething(){
    // groovylint-disable
            if (a == 2)
                doSomething();
    // groovylint-enable
    def a = 1;
}
`,
            },
        ],
        [
            "GroovyDisableEnableIndentation",
            {
                totalFound: 5,
                source: `
private void doSomething(){
    /* groovylint-disable Indentation */
            if (a == 2)
                doSomething();
    /* groovylint-enable Indentation */
         def a = 1;
}
`,
            },
        ],
        [
            "GroovyDisableEnableIndentationUnnecessarySemicolon",
            {
                totalFound: 4,
                source: `
private void doSomething(){
    /* groovylint-disable Indentation, UnnecessarySemicolon */
            if (a == 2)
                doSomething();
    /* groovylint-enable Indentation, UnnecessarySemicolon */
         def a = 1;
}
`,
            },
        ],
    ]);
}
