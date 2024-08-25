// Additional definition for codenarc rules ( get position & available fix)

// Rule Template:
/*
   const rule = {

        // add scope = "file" if the fix impacts more than the identified line (If fix defined)
        scope: "file", // default: line

        // add isCodeNarcRule: false if the rule is not part of CodeNarc list of supported rules ( but triggered by another rule with trigger property)
        isCodeNarcRule: false, // default: true

        // If the fix rule must be run only once by file, set unitary = true
        unitary: false,

        // If the fix solves the same errors on the same line, set fixesSameErrorOnSameLine : true,
        fixesSameErrorOnSameLine: false ,

        // List of other rules fix that this rule fix must trigger (if fix defined)
        triggers: ["SomeOtherRule","AnotherRule"],

        // Some rules like IfStatementBraces and ElseBlockBraces require to run again the lint & fix after they are corrected (usually Indentation rule)
        triggersAgainAfterFix: ["Indentation"],

        // Extract variables from CodeNarc error message (optional)
        variables: [
            {
                name: "MYVAR",
                regex: /The (.*) is at the incorrect indent level: Expected column (.*) but was (.*)/,
                regexPos: 1,
                type: "number"
            },
            {
                name: "MYOTHERVAR",
                regex: /The (.*) is at the incorrect indent level: Expected column (.*) but was (.*)/,
                regexPos: 2,
            }
        ],

        // Return range for UI . Input: errorLine, errorItem, evaluated variables
        range: {
            type: "function",
            func: (_errLine, errItem, evaluatedVars) => {
                const myVar = getVariable(evaluatedVars, "MYVAR");
                return {
                    start: { line: errItem.line, character: 0 },
                    end: { line: errItem.line, character: myVar.length }
                };
            }
        },

        // Fix if scope = file
        fix: {
            label: "Label of the fix",
            type: "function",
            func: allLines => {
                // update allLines here
                return allLines;
            }
        },
        // Fix if scope = line
        fix: {
            label: "Label of the fix",
            type: "function",
            func: (line, evaluatedVars) => {
                const myVar = getVariable(evaluatedVars, "MYOTHERVAR");
                line = line.replace(myVar, 'whatever');
                return line;
            }
        },

        // Definition for automated tests (mocha).
        // If a fix is defined, define at least one test with sourceBefore and sourceAfter expected value
        tests: [
            {
sourceBefore: `
def str = "lelamanul"                
`,
sourceAfter: `
str = "lelamanul"
`
            }
        ]
    }

    export default  { rule }

*/

import fs from "fs-extra";
const { readdirSync } = fs;
import * as path from "path";
import { fileURLToPath } from "url";

// If you add a new global rule with a fix function, it's very important to think about their order.
// Rules modifying the number of lines must arrive last !
const rulesFixPriorityOrder = [
    // Line rules or not changing number of lines rules
    "NoTabCharacter",
    "Indentation",
    "AssignmentInConditional",
    "UnnecessaryGString",
    "UnnecessaryToString",
    "ExplicitArrayListInstantiation",
    "ExplicitLinkedListInstantiation",
    "SpaceBeforeOpeningBrace",
    "SpaceAfterOpeningBrace",
    "SpaceAfterCatch",
    "SpaceAfterMethodCallName",
    "SpaceAfterSwitch",
    "SpaceAfterWhile",
    "SpaceAroundOperator",
    "SpaceAfterComma",
    "SpaceAfterSemicolon",
    "SpaceAfterFor",
    "SpaceAfterIf",
    "SpaceAfterSwitch",
    "SpaceBeforeClosingBrace",
    "SpaceInsideParentheses",
    "UnnecessaryDefInFieldDeclaration",
    "UnnecessaryDefInMethodDeclaration",
    "UnnecessaryDefInVariableDeclaration",
    "UnnecessaryDotClass",
    "UnnecessaryFinalOnPrivateMethod",
    "UnnecessaryInstantiationToGetClass",
    "UnnecessaryPackageReference",
    "UnnecessaryParenthesesForMethodCallWithClosure",
    "UnnecessarySemicolon",
    "TrailingWhitespace",

    // Rule that can change the numbers of lines, so they must be processed after line scope rules
    "UnnecessaryGroovyImport",
    "UnusedImport",
    "InsecureRandom",
    "DuplicateImport",
    "BlankLineBeforePackage",
    "BlockStartsWithBlankLine",
    "BlockEndsWithBlankLine",
    "BracesForClass",
    "BracesForForLoop",
    "BracesForIfElse",
    "BracesForMethod",
    "BracesForTryCatchFinally",
    "ClassStartsWithBlankLine",
    "ClassEndsWithBlankLine",
    "MissingBlankLineAfterPackage",
    "MissingBlankLineAfterImports",
    "MisorderedStaticImports",
    "IfStatementBraces",
    "ElseBlockBraces",
    "ClosingBraceNotAlone",
    "IndentationClosingBraces",
    "IndentationComments",
    "ConsecutiveBlankLines",
    "FileEndsWithoutNewline",
];

// CodeNarc formatting fix rules are triggered after CodeNarc returns violations
// Non-CodeNarc formatting fix rules (existing only in npm-groovy-lint) must be run always
const formatRulesToAlwaysRun = ["IndentationClosingBraces", "IndentationComments"];

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RULES_FOLDER = __dirname + "/rules";

export async function getNpmGroovyLintRules(optns = { loadTests: false }) {
    const ruleFiles = readdirSync(RULES_FOLDER);
    const npmGroovyLintRules = {};
    for (const file of ruleFiles) {
        const ruleName = file.replace(".js", "");
        // Remove require cache if tests must be returned (other calls delete them in the cache)
        if (optns && optns.loadTests === true) {
            // delete require.cache[require.resolve(`${RULES_FOLDER}/${file}`)]; Not ESM compliant
        }
        const { rule } = await import("./rules/" + file);
        if (rule.disabled) {
            continue;
        }
        // Check priority is defined
        rule.priority = rulesFixPriorityOrder.indexOf(ruleName);
        if (rule.fix && rule.priority < 0) {
            throw new Error(`Rule ${ruleName} must have an order defined in groovy-lint-rules.js/rulesFixPriorityOrder`);
        }
        // Remove tests if not in test mode
        if (optns && optns.loadTests === false) {
            delete rule.tests;
        }
        npmGroovyLintRules[ruleName] = rule;
    }
    return npmGroovyLintRules;
}

export function getFormattingRulesToAlwaysRun() {
    return formatRulesToAlwaysRun;
}
