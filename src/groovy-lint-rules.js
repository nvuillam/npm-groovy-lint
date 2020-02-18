// List fixable CodeNarc rules
"use strict";

const npmGroovyLintRules = {

    // Consecutive blank lines
    ConsecutiveBlankLines: {
        scope: 'file',
        fixes: [
            {
                type: "function",
                func: fileLines => {
                    const newFileLines = [];
                    for (const line of fileLines) {
                        if (line.trim() === '') {
                            // Check if previous line is empty: if not, add empty line
                            if (!(newFileLines.length > 0 && newFileLines[newFileLines.length - 1].trim() === '')) {
                                newFileLines.push('');
                            }
                        }
                        else {
                            newFileLines.push(line);
                        }
                    }
                    return newFileLines;
                }
            }
        ]
    },

    // Indentation
    Indentation: {
        variables: [
            {
                name: "EXPECTED",
                regex: /The statement on line (.*) in class (.*) is at the incorrect indent level: Expected column (.*) but was (.*)/,
                regexPos: 3
            },
            {
                name: "FOUND",
                regex: /The statement on line (.*) in class (.*) is at the incorrect indent level: Expected column (.*) but was (.*)/,
                regexPos: 4
            },
            {
                name: "EXPECTED",
                regex: /The method (.*) in class (.*) is at the incorrect indent level: Expected column (.*) but was (.*)/,
                regexPos: 3
            },
            {
                name: "FOUND",
                regex: /The method (.*) in class (.*) is at the incorrect indent level: Expected column (.*) but was (.*)/,
                regexPos: 4
            },
        ],
        fixes: [
            {
                type: "function",
                func: (newLine, evaluatedVars) => {
                    const expectedIndent = parseInt(getVariable(evaluatedVars, "EXPECTED", { mandatory: true }), 10);
                    const foundIndent = parseInt(getVariable(evaluatedVars, "FOUND", { mandatory: true }));
                    if (newLine.trim() === '}') {
                        // Manage Wrong info frrom codeNarc :/ {
                        newLine = newLine.replace(" ".repeat(foundIndent - 1), " ".repeat((expectedIndent - 1) * 2));
                    }
                    else {
                        newLine = newLine.replace(" ".repeat(foundIndent - 1), " ".repeat(expectedIndent - 1));
                    }
                    return newLine.trimEnd();
                }
            }
        ]
    },

    // Space after opening brace
    SpaceAfterOpeningBrace: {
        fixes: [
            {
                type: "replaceString",
                before: "{}",
                after: "{ }"
            }
        ]
    },

    // Space around operators
    SpaceAroundOperator: {
        variables: [
            {
                name: "OPERATOR",
                regex: /The operator "(.*)" within class (.*) is not preceded by a space or whitespace/
            }
        ],
        fixes: [
            {
                type: "function",
                func: (newLine, evaluatedVars) => {
                    const operator = getVariable(evaluatedVars, "OPERATOR");
                    let pos = 0;
                    const newArray = newLine.split(operator).map(str => {
                        pos++;
                        if (pos === 1) {
                            return str.trimEnd();
                        } else {
                            return str.trim();
                        }
                    });
                    return newArray.join(" " + operator + " ");
                }
            }
        ]
    },

    // Unnecessary def in field declaration (statif def)
    UnnecessaryDefInFieldDeclaration: {
        fixes: [
            {
                type: "replaceString",
                before: "static def ",
                after: "static "
            }
        ]
    },

    // Unnecessary Groovy String
    UnnecessaryGString: {
        variables: [
            {
                name: "STRING",
                regex: /The String '(.*)' can be wrapped in single quotes instead of double quotes/
            }
        ],
        fixes: [
            {
                type: "replaceString",
                before: "{{DOUBLE_QUOTE}}{{STRING}}{{DOUBLE_QUOTE}}",
                after: "{{SINGLE_QUOTE}}{{STRING}}{{SINGLE_QUOTE}}"
            }
        ]
    },

    // Unnecessary public declaration (public is by default)
    UnnecessaryPublicModifier: {
        fixes: [
            {
                type: "replaceString",
                before: "public ",
                after: ""
            }
        ]
    },

    // Unnecessary semi colon at the end of a line
    UnnecessarySemicolon: {
        fixes: [
            {
                type: "function",
                func: newLine => {
                    newLine = newLine.trimEnd();
                    if (newLine.lastIndexOf(";") === (newLine.length - 1)) {
                        newLine = newLine.substring(0, newLine.length - 1).trimEnd();
                    }
                    return newLine;
                }
            }
        ]
    }
};

const npmGroovyLintGlobalReplacements = [
    { name: "DOUBLE_QUOTE", value: '"' },
    { name: "SINGLE_QUOTE", value: "'" }
];

function getVariable(evaluatedVars, name, optns = { mandatory: false }) {
    const matchingVars = evaluatedVars.filter(evaluatedVar => evaluatedVar.name === name);
    if (matchingVars && matchingVars.length > 0) {
        return matchingVars[0].value;
    } else if (optns.mandatory) {
        throw new Error("NGL fix: missing mandatory variable " + name + " in " + JSON.stringify(evaluatedVars));
    } else {
        return null;
    }
}

module.exports = { npmGroovyLintRules, npmGroovyLintGlobalReplacements };
