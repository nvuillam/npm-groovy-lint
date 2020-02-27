// Additional definition for codenarc rules ( get position & available fix)

// Rule Template:
/*
   RuleName: {
        // add scope = "file" if the fix impacts more than the identified line (If fix defined)
        scope: "file",
        // Define a priority at the top of groovy-lint-rules.js (If fix defined)
        priority: getPriority("RuleName"),
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
            type: "function",
            func: allLines => {
                // update allLines here
                return allLines;
            }
        },
        // Fix if scope = line
        fix: {
            type: "function",
            func: (line, evaluatedVars) => {
                const myVar = getVariable(evaluatedVars, "MYOTHERVAR");
                line = line.replace(myVar, 'whatever');
                return line;
            }
        }
    },

*/

"use strict";

const decodeHtml = require("decode-html");

// Default indent length
const indentLength = 4;

// If you add a new global rule, it's very important to think about their order.
// Rules modifiyng the number of lines must arrive last !
const rulesFixPriorityOrder = [
    // Line rules or not changing line rules
    "NoTabCharacter",
    "TrailingWhitespace",
    "Indentation",
    "UnnecessaryGString",
    "SpaceBeforeOpeningBrace",
    "SpaceAfterOpeningBrace",
    "SpaceAfterCatch",
    "SpaceAroundOperator",
    "SpaceAfterComma",
    "UnnecessaryDefInFieldDeclaration",
    "UnnecessarySemicolon",

    // Rule that can change the numbers of lines, so they must be processed after line scope rules

    "IfStatementBraces",
    "ElseBlocktBraces",
    "ConsecutiveBlankLines",
    "ClosingBraceNotAlone",
    "IndentationClosingBraces",
    "IndentationComments",
    "FileEndsWithoutNewline"
];

const npmGroovyLintRules = {
    // Braces for if else
    BracesForIfElse: {
        range: {
            type: "function",
            func: (_errLine, errItem, _evaluatedVars, allLines) => {
                return findRangeBetweenStrings(allLines, errItem, "if", "{");
            }
        }
    },

    // Closing brace not alone
    ClosingBraceNotAlone: {
        scope: "file",
        priority: getPriority("ClosingBraceNotAlone"),
        range: {
            type: "function",
            func: (errLine, errItem) => {
                const closingBracePos = errLine.lastIndexOf("}");
                return {
                    start: { line: errItem.line, character: closingBracePos },
                    end: { line: errItem.line, character: closingBracePos + 1 }
                };
            }
        },
        fix: {
            type: "function",
            func: allLines => {
                const newFileLines = [];
                let prevLine = "";
                for (const line of allLines) {
                    const newLine = line.replace("{{{NEWLINECLOSINGBRACE}}}", "");
                    const prevLineIndent = prevLine.search(/\S/);
                    newFileLines.push(newLine);
                    if (newLine !== line) {
                        newFileLines.push(" ".repeat(prevLineIndent) + "}");
                    }
                    prevLine = newLine;
                }
                return newFileLines;
            }
        }
    },

    // Consecutive blank lines
    ConsecutiveBlankLines: {
        scope: "file",
        priority: getPriority("ConsecutiveBlankLines"),
        fix: {
            type: "function",
            func: allLines => {
                const newFileLines = [];
                let prevLine = "none";
                for (const line of allLines) {
                    if (!(line.trim() === "" && prevLine.trim() === "")) {
                        // Check if previous line is empty: if not do not add line
                        newFileLines.push(line);
                        prevLine = line;
                    }
                }
                return newFileLines;
            }
        }
    },

    // Missing else braces
    ElseBlocktBraces: {
        scope: "file",
        unitary: true,
        triggers: ["ClosingBraceNotAlone"],
        priority: getPriority("ElseBlocktBraces"),
        range: {
            type: "function",
            func: (errLine, errItem) => {
                return getStringRange(errLine, "else", errItem);
            }
        },
        fix: {
            type: "function",
            func: (allLines, variables) => {
                const lineNumber = getVariable(variables, "lineNb", { mandatory: true });
                // If next line is also a if/else, this rule can not autofix for now, it has to be done manually
                if (allLines[lineNumber + 1] && lineNumber[lineNumber + 1].includes("else")) {
                    return allLines;
                }
                let line = allLines[lineNumber];
                line = line.trimEnd() + " {";
                allLines[lineNumber] = line;
                // next line
                let match = false;
                let pos = 0;
                let level = 0;
                while (!match && pos < allLines.length) {
                    let nextLine = allLines[lineNumber + pos + 1];
                    if (isValidCodeLine(nextLine) && level === 0) {
                        if (!nextLine.trim().startsWith("if") && !nextLine.includes("{")) {
                            nextLine = nextLine + "{{{NEWLINECLOSINGBRACE}}}";
                            allLines[lineNumber + pos + 1] = nextLine;
                            match = true;
                        } else if (nextLine.includes("}") && !nextLine.includes("{")) {
                            level--;
                        } else {
                            level++;
                        }
                    }
                    pos++;
                }
                return allLines;
            }
        }
    },

    // File ends without new line
    FileEndsWithoutNewline: {
        scope: "file",
        priority: getPriority("FileEndsWithoutNewline"),
        fix: {
            type: "function",
            func: allLines => {
                return (allLines.join("\r\n") + "\r\n").split("\r\n");
            }
        }
    },

    // nvuillam: Fix not working, especially when embedded missing If statements ...
    //   let's let people correct that manually for now :)
    // Missing if braces
    IfStatementBraces: {
        scope: "file",
        unitary: true,
        triggers: ["ClosingBraceNotAlone"],
        priority: getPriority("IfStatementBraces"),
        range: {
            type: "function",
            func: (errLine, errItem) => {
                return getStringRange(errLine, "else", errItem);
            }
        },
        fix: {
            type: "function",
            func: (allLines, variables) => {
                const lineNumber = getVariable(variables, "lineNb", { mandatory: true });
                // If next line is also a if/else, this rule can not autofix for now, it has to be done manually
                if (allLines[lineNumber + 1] && (allLines[lineNumber + 1].includes("if") || allLines[lineNumber + 1].includes("else"))) {
                    return allLines;
                }
                // If line
                let line = allLines[lineNumber];
                line = line.trimEnd() + " {";
                allLines[lineNumber] = line;
                // next line
                let match = false;
                let pos = 0;
                let level = 0;
                while (!match && pos < allLines.length) {
                    let nextLine = allLines[lineNumber + pos + 1];
                    if (isValidCodeLine(nextLine) && level === 0) {
                        if (!nextLine.trim().startsWith("if") && !nextLine.includes("{")) {
                            nextLine = nextLine + "{{{NEWLINECLOSINGBRACE}}}";
                            allLines[lineNumber + pos + 1] = nextLine;
                            match = true;
                        } else if (nextLine.includes("}") && !nextLine.includes("{")) {
                            level--;
                        } else {
                            level++;
                        }
                    }
                    pos++;
                }
                return allLines;
            }
        }
    },

    // Indentation
    Indentation: {
        triggers: ["IndentationClosingBraces", "IndentationComments"],
        priority: getPriority("Indentation"),
        variables: [
            {
                name: "EXPECTED",
                regex: /The (.*) is at the incorrect indent level: Expected column (.*) but was (.*)/,
                regexPos: 2,
                type: "number"
            },
            {
                name: "FOUND",
                regex: /The (.*) is at the incorrect indent level: Expected column (.*) but was (.*)/,
                regexPos: 3,
                type: "number"
            }
        ],
        range: {
            type: "function",
            func: (errLine, errItem, evaluatedVars) => {
                return {
                    start: { line: errItem.line, character: getVariable(evaluatedVars, "EXPECTED") },
                    end: { line: errItem.line, character: getVariable(evaluatedVars, "FOUND") }
                };
            }
        },
        fix: {
            type: "function",
            func: (line, evaluatedVars) => {
                const expectedCol = parseInt(getVariable(evaluatedVars, "EXPECTED", { mandatory: true, line: line }), 10);
                //                const foundIndent = parseInt(getVariable(evaluatedVars, "FOUND", { mandatory: true, line: line }));
                /*     if (line.trim() === "}") {
                         // Manage Wrong info from codeNarc :/ {
                         line = " ".repeat(expectedIndent + (indentLength * 2)) + line.trimStart();
                     } else { */
                const startSpaces = expectedCol === 0 ? 0 : expectedCol - 1;
                line = " ".repeat(startSpaces) + line.trimStart();
                return line;
            }
        }
    },

    // Indentation comments
    IndentationComments: {
        scope: "file",
        priority: getPriority("IndentationComments"),
        fix: {
            type: "function",
            func: allLines => {
                const newFileLines = [];
                for (let i = 0; i < allLines.length; i++) {
                    let line = allLines[i];
                    // Detect comment line
                    if (line.trimStart().startsWith("//")) {
                        // Find indentation of next line (which is not blank or a comment)
                        let j = 1;
                        let nextLineIndent = null;
                        while (allLines[i + j] && nextLineIndent == null) {
                            if (!/^\s*$/.test(allLines[i + j]) && !allLines[i + j].trimStart().startsWith("//")) {
                                nextLineIndent = allLines[i + j].search(/\S/); // find first non blank character
                            }
                            j++;
                        }
                        // Set new indentation it on this comment line
                        if (nextLineIndent) {
                            line = " ".repeat(nextLineIndent) + line.trimStart();
                        }
                    }
                    newFileLines.push(line);
                }
                return newFileLines;
            }
        }
    },

    // Indentation closing braces
    IndentationClosingBraces: {
        scope: "file",
        priority: getPriority("IndentationClosingBraces"),
        fix: {
            type: "function",
            func: allLines => {
                const newFileLines = [];
                for (let i = 0; i < allLines.length; i++) {
                    let line = allLines[i] + "";
                    // Detect closing brace line
                    if (line.trim() === "}") {
                        // Find indentation of matching brace (CodeNarc Indentation rule does not always work well :/ )
                        let j = 1;
                        let matchingLineIndent = null;
                        let level = 1;
                        while ((allLines[i - j] || allLines[i - j] === "") && matchingLineIndent == null) {
                            const prevLine = allLines[i - j];
                            if (prevLine.includes("}") && !prevLine.includes("${")) {
                                level++;
                            }
                            if (prevLine.includes("{") && !prevLine.includes("${")) {
                                level--;
                                if (level === 0) {
                                    matchingLineIndent = prevLine.search(/\S/);
                                }
                            }
                            j++;
                        }
                        // Set new indentation it on this comment line
                        if (matchingLineIndent) {
                            line = (" ".repeat(matchingLineIndent) + line.trimStart()).replace(/\t/g, "");
                        }
                    }
                    newFileLines.push(line);
                }
                return newFileLines;
            }
        }
    },

    // No use of Java.io classes
    JavaIoPackageAccess: {
        variables: [
            {
                name: "CLASSNAME",
                regex: /The use of java.io.(.*) violates the Enterprise Java Bean specification/,
                regexPos: 1
            }
        ],
        range: {
            type: "function",
            func: (errLine, errItem, evaluatedVars) => {
                return getVariableRange(errLine, evaluatedVars, "CLASSNAME", errItem);
            }
        }
    },

    // Too many methods in a class
    MethodCount: {
        variables: [
            {
                name: "CLASSNAME",
                regex: /Class (.*) has 52 methods/,
                regexPos: 1
            }
        ],
        range: {
            type: "function",
            func: (errLine, errItem, evaluatedVars) => {
                return getVariableRange(errLine, evaluatedVars, "CLASSNAME", errItem);
            }
        }
    },

    // No use of Java.util.date
    NoJavaUtilDate: {
        range: {
            type: "function",
            func: (errLine, errItem) => {
                return getStringRange(errLine, "Date", errItem);
            }
        }
    },

    // No tab character
    NoTabCharacter: {
        scope: "file",
        priority: getPriority("NoTabCharacter"),
        fix: {
            type: "function",
            func: allLines => {
                const newFileLines = [];
                const replaceChars = " ".repeat(indentLength);
                for (const line of allLines) {
                    newFileLines.push(line.replace(/\t/g, replaceChars));
                }
                return newFileLines;
            }
        }
    },

    // Space after catch
    SpaceAfterCatch: {
        range: {
            type: "function",
            func: (errLine, errItem) => {
                return getStringRange(errLine, "){", errItem);
            }
        },
        priority: getPriority("SpaceAfterCatch"),
        fix: {
            type: "replaceString",
            before: "){",
            after: ") {"
        }
    },

    // Space after opening brace
    SpaceAfterOpeningBrace: {
        priority: getPriority("SpaceAfterOpeningBrace"),
        range: {
            type: "function",
            func: (errLine, errItem) => {
                return getStringRange(errLine, "{", errItem);
            }
        },
        fix: {
            type: "function",
            func: line => {
                const regexMatch = line.match(new RegExp(/{[^ ]/, "g"));
                if (regexMatch && regexMatch[0]) {
                    line = line.replace(regexMatch[0], "{ " + regexMatch[0][1]);
                }
                return line;
            }
        }
    },

    // Space around operators
    SpaceAroundOperator: {
        priority: getPriority("SpaceAroundOperator"),
        variables: [
            {
                name: "OPERATOR",
                regex: /The operator "(.*)" within class (.*) is not (.*) by a space or whitespace/
            }
        ],
        range: {
            type: "function",
            func: (errLine, errItem, evaluatedVars) => {
                return getVariableRange(errLine, evaluatedVars, "OPERATOR", errItem);
            }
        },
        fix: {
            type: "function",
            func: (line, evaluatedVars) => {
                let operator = getVariable(evaluatedVars, "OPERATOR", { mandatory: true, htmlToString: true, line: line });
                if (!line.includes("+=") && !line.includes("++") && !line.includes("--") && !line.includes("-=")) {
                    return addSpaceAroundChar(line, operator);
                } else {
                    return line;
                }
            }
        }
    },

    // Add space after a comma
    SpaceAfterComma: {
        priority: getPriority("SpaceAfterComma"),
        range: {
            type: "function",
            func: (errLine, errItem) => {
                return getStringRange(errLine, ",", errItem);
            }
        },
        fix: {
            type: "function",
            func: line => {
                return addSpaceAroundChar(line, ",");
            }
        }
    },

    // Space before opening brace
    SpaceBeforeOpeningBrace: {
        priority: getPriority("SpaceBeforeOpeningBrace"),
        range: {
            type: "function",
            func: (errLine, errItem) => {
                return getStringRange(errLine, "{", errItem);
            }
        },
        fix: {
            type: "function",
            func: line => {
                const regexMatch = line.match(new RegExp(/[^ ]{/, "g"));
                if (regexMatch && regexMatch[0]) {
                    line = line.replace(regexMatch[0], regexMatch[0][0] + " {");
                }
                return line;
            }
        }
    },

    // System.exit forbidden
    SystemExit: {
        range: {
            type: "function",
            func: (errLine, errItem, evaluatedVars) => {
                return getVariableRange(errLine, evaluatedVars, "System.exit", errItem);
            }
        }
    },

    // Trailing Whitespaces
    TrailingWhitespace: {
        priority: getPriority("TrailingWhitespace"),
        range: {
            type: "function",
            func: (errLine, errItem) => {
                const diff = errLine.length - errLine.trimEnd().length;
                return {
                    start: { line: errItem.line, character: errLine.length - diff },
                    end: { line: errItem.line, character: errLine.length }
                };
            }
        },
        fix: {
            type: "function",
            func: line => {
                return line.trimEnd();
            }
        }
    },

    // Unnecessary def in field declaration (statif def)
    UnnecessaryDefInFieldDeclaration: {
        priority: getPriority("UnnecessaryDefInFieldDeclaration"),
        range: {
            type: "function",
            func: (errLine, errItem) => {
                return getStringRange(errLine, "def", errItem);
            }
        },
        fix: {
            type: "replaceString",
            before: "def ",
            after: ""
        }
    },

    // Unnecessary Groovy String
    UnnecessaryGString: {
        priority: getPriority("UnnecessaryGString"),
        variables: [
            {
                name: "STRING",
                regex: /The String '(.*)' can be wrapped in single quotes instead of double quotes/
            }
        ],
        range: {
            type: "function",
            func: (errLine, errItem, evaluatedVars) => {
                return getVariableRange(errLine, evaluatedVars, "STRING", errItem);
            }
        },
        fix: {
            type: "replaceString",
            before: '"{{STRING}}"',
            after: "'{{STRING}}'"
        }
    },

    // Unnecessary semi colon at the end of a line
    UnnecessarySemicolon: {
        priority: getPriority("UnnecessarySemicolon"),
        range: {
            type: "function",
            func: (errLine, errItem) => {
                return getLastStringRange(errLine, ";", errItem);
            }
        },
        fix: {
            type: "function",
            func: line => {
                if ((line.match(/;/g) || []).length === 1) {
                    line = line.split(";").join("");
                }
                return line;
            }
        }
    },

    // Unused method parameter
    UnusedMethodParameter: {
        variables: [
            {
                name: "PARAMNAME",
                regex: /Violation in class (.*) Method parameter \[(.*)\] is never referenced in the method (.*) of class (.*)/,
                regexPos: 2
            }
        ],
        range: {
            type: "function",
            func: (errLine, errItem, evaluatedVars) => {
                return getVariableRange(errLine, evaluatedVars, "PARAMNAME", errItem);
            }
        }
    },

    // Unused variable
    UnusedVariable: {
        variables: [
            {
                name: "VARNAME",
                regex: /The variable \[(.*)\] in (.*) is not used/
            }
        ],
        range: {
            type: "function",
            func: (errLine, errItem, evaluatedVars) => {
                return getVariableRange(errLine, evaluatedVars, "VARNAME", errItem);
            }
        }
    }
};

function getPriority(ruleName) {
    return rulesFixPriorityOrder.indexOf(ruleName);
}

function getVariable(evaluatedVars, name, optns = { mandatory: true, decodeHtml: false, line: "" }) {
    const matchingVars = evaluatedVars.filter(evaluatedVar => evaluatedVar.name === name);
    if (matchingVars && matchingVars.length > 0) {
        return optns.decodeHtml ? decodeHtml(matchingVars[0].value) : matchingVars[0].value;
    } else if (optns.mandatory) {
        throw new Error("NGL fix: missing mandatory variable " + name + " in " + JSON.stringify(evaluatedVars)) + "for line :\n" + optns.line;
    } else {
        return null;
    }
}

function getStringRange(errLine, str, errItem) {
    const varStartPos = errLine.indexOf(str);
    return {
        start: { line: errItem.line, character: varStartPos },
        end: { line: errItem.line, character: varStartPos + str.length }
    };
}

function getLastStringRange(errLine, str, errItem) {
    const varStartPos = errLine.lastIndexOf(str);
    return {
        start: { line: errItem.line, character: varStartPos },
        end: { line: errItem.line, character: varStartPos + str.length }
    };
}

function getVariableRange(errLine, evaluatedVars, variable, errItem) {
    const varValue = getVariable(evaluatedVars, variable);
    return getStringRange(errLine, varValue, errItem);
}

function findRangeBetweenStrings(allLines, errItem, strStart, strEnd) {
    let range = {
        start: { line: errItem.line, character: 0 },
        end: { line: errItem.line, character: allLines[errItem.line - 1].length }
    };
    let pos = errItem.line - 1;
    let isStartFound = false;
    let isEndFound = false;
    while ((isStartFound === false || isEndFound === false) && pos < allLines.length) {
        if (!isStartFound && allLines[pos].indexOf(strStart) > -1) {
            range.start = { line: pos, character: allLines[pos].indexOf(strStart) };
        }
        if (!isEndFound && allLines[pos].indexOf(strEnd) > -1) {
            range.end = { line: pos, character: allLines[pos].indexOf(strEnd) };
            isEndFound = true;
        }
        pos++;
    }
    return range;
}

function isValidCodeLine(line) {
    return line.trim() !== "" && line.trim().split("//")[0] !== "";
}

function addSpaceAroundChar(line, char) {
    let pos = -1;
    const splits = line.split(char);
    const newArray = splits.map(str => {
        pos++;
        if (pos === 0) {
            return str.trimEnd();
        } else if (pos === splits.length - 1) {
            return str.trimStart();
        } else {
            return str.trim();
        }
    });
    return newArray.join(" " + char + " ").trimEnd();
}

module.exports = { npmGroovyLintRules };
