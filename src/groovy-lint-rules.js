// Additional definition for codenarc rules ( get position & available fix)

// Rule Template:
/*
   const rule = {

        // add scope = "file" if the fix impacts more than the identified line (If fix defined)
        scope: "file", // default: line

        // add isCodeNarcRule: false if the rule is not part of CodeNarc list of supported rules ( but triggered by another rule with trigger property)
        isCodeNarcRule: false, // default: true

        // List of other rules fix that this rule fix must trigger (if fix defined)
        triggers: ["SomeOtherRule","AnotherRule"],

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

    module.exports = { rule }

*/

"use strict";

const fse = require("fs-extra");

// If you add a new global rule, it's very important to think about their order.
// Rules modifiyng the number of lines must arrive last !
const rulesFixPriorityOrder = [
    // Line rules or not changing line rules
    "NoTabCharacter",
    "Indentation",
    "UnnecessaryGString",
    "SpaceBeforeOpeningBrace",
    "SpaceAfterOpeningBrace",
    "SpaceAfterCatch",
    "SpaceAroundOperator",
    "SpaceAfterComma",
    "UnnecessaryDefInFieldDeclaration",
    "UnnecessarySemicolon",
    "TrailingWhitespace",

    // Rule that can change the numbers of lines, so they must be processed after line scope rules
    "IfStatementBraces",
    "ElseBlocktBraces",
    "ConsecutiveBlankLines",
    "ClosingBraceNotAlone",
    "IndentationClosingBraces",
    "IndentationComments",
    "FileEndsWithoutNewline"
];

const RULES_FOLDER = __dirname + "/rules";

const ruleFiles = fse.readdirSync(RULES_FOLDER);
const npmGroovyLintRules = {};
for (const file of ruleFiles) {
    const ruleName = file.replace(".js", "");
    const { rule } = require(`${RULES_FOLDER}/${file}`);
    if (rule.disabled) {
        continue;
    }
    rule.priority = rulesFixPriorityOrder.indexOf(ruleName);
    npmGroovyLintRules[ruleName] = rule;
}

module.exports = { npmGroovyLintRules };
