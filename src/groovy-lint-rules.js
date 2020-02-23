// List fixable CodeNarc rules
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
    "ElseStatementBraces",
    "ConsecutiveBlankLines",
    "ClosingBraceNotAlone",
    "IndentationClosingBraces",
    "IndentationComments",
    "FileEndsWithoutNewline"
];

const npmGroovyLintRules = {
    // Closing brace not alone
    ClosingBraceNotAlone: {
        scope: "file",
        priority: getPriority("ClosingBraceNotAlone"),
        fix: {
            type: "function",
            func: fileLines => {
                const newFileLines = [];
                let prevLine = "";
                for (const line of fileLines) {
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
            func: fileLines => {
                const newFileLines = [];
                let prevLine = "none";
                for (const line of fileLines) {
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

    // File ends without new line
    FileEndsWithoutNewline: {
        scope: "file",
        priority: getPriority("FileEndsWithoutNewline"),
        fix: {
            type: "function",
            func: fileLines => {
                return (fileLines.join("\r\n") + "\r\n").split("\r\n");
            }
        }
    },

    // nvuillam: Not working, especially when embedded missing If statements ...
    //   let's let people correct that manually for now :)
    // Missing if braces
    IfStatementBraces: {
        scope: "file",
        unitary: true,
        triggers: ["ClosingBraceNotAlone"],
        priority: getPriority("IfStatementBraces"),
        fix: {
            type: "function",
            func: (fileLines, variables) => {
                const lineNumber = getVariable(variables, "lineNb", { mandatory: true });
                // If next line is also a if/else, this rule can not autofix for now, it has to be done manually
                if (fileLines[lineNumber + 1] && (fileLines[lineNumber + 1].includes("if") || fileLines[lineNumber + 1].includes("else"))) {
                    return fileLines;
                }
                // If line
                let line = fileLines[lineNumber];
                line = line.trimEnd() + " {";
                fileLines[lineNumber] = line;
                // next line
                let match = false;
                let pos = 0;
                let level = 0;
                while (!match && pos < fileLines.length) {
                    let nextLine = fileLines[lineNumber + pos + 1];
                    if (isValidCodeLine(nextLine) && level === 0) {
                        if (!nextLine.trim().startsWith("if") && !nextLine.includes("{")) {
                            nextLine = nextLine + "{{{NEWLINECLOSINGBRACE}}}";
                            fileLines[lineNumber + pos + 1] = nextLine;
                            match = true;
                        } else if (nextLine.includes("}") && !nextLine.includes("{")) {
                            level--;
                        } else {
                            level++;
                        }
                    }
                    pos++;
                }
                return fileLines;
            }
        }
    },

    // Missing else braces
    ElseStatementBraces: {
        scope: "file",
        unitary: true,
        triggers: ["ClosingBraceNotAlone"],
        priority: getPriority("ElseStatementBraces"),
        fix: {
            type: "function",
            func: (fileLines, variables) => {
                const lineNumber = getVariable(variables, "lineNb", { mandatory: true });
                // If next line is also a if/else, this rule can not autofix for now, it has to be done manually
                if (fileLines[lineNumber + 1] && (lineNumber[lineNumber + 1].includes("if") || lineNumber[lineNumber + 1].includes("else"))) {
                    return fileLines;
                }
                let line = fileLines[lineNumber];
                line = line.trimEnd() + " {";
                fileLines[lineNumber] = line;
                // next line
                let match = false;
                let pos = 0;
                let level = 0;
                while (!match && pos < fileLines.length) {
                    let nextLine = fileLines[lineNumber + pos + 1];
                    if (isValidCodeLine(nextLine) && level === 0) {
                        if (!nextLine.trim().startsWith("if") && !nextLine.includes("{")) {
                            nextLine = nextLine + "{{{NEWLINECLOSINGBRACE}}}";
                            fileLines[lineNumber + pos + 1] = nextLine;
                            match = true;
                        } else if (nextLine.includes("}") && !nextLine.includes("{")) {
                            level--;
                        } else {
                            level++;
                        }
                    }
                    pos++;
                }
                return fileLines;
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
                regexPos: 2
            },
            {
                name: "FOUND",
                regex: /The (.*) is at the incorrect indent level: Expected column (.*) but was (.*)/,
                regexPos: 3
            }
        ],
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
            func: fileLines => {
                const newFileLines = [];
                for (let i = 0; i < fileLines.length; i++) {
                    let line = fileLines[i];
                    // Detect comment line
                    if (line.trimStart().startsWith("//")) {
                        // Find indentation of next line (which is not blank or a comment)
                        let j = 1;
                        let nextLineIndent = null;
                        while (fileLines[i + j] && nextLineIndent == null) {
                            if (!/^\s*$/.test(fileLines[i + j]) && !fileLines[i + j].trimStart().startsWith("//")) {
                                nextLineIndent = fileLines[i + j].search(/\S/); // find first non blank character
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
            func: fileLines => {
                const newFileLines = [];
                for (let i = 0; i < fileLines.length; i++) {
                    let line = fileLines[i] + "";
                    // Detect closing brace line
                    if (line.trim() === "}") {
                        // Find indentation of matching brace (CodeNarc Indentation rule does not always work well :/ )
                        let j = 1;
                        let matchingLineIndent = null;
                        let level = 1;
                        while ((fileLines[i - j] || fileLines[i - j] === "") && matchingLineIndent == null) {
                            const prevLine = fileLines[i - j];
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

    // No tab character
    NoTabCharacter: {
        scope: "file",
        priority: getPriority("NoTabCharacter"),
        fix: {
            type: "function",
            func: fileLines => {
                const newFileLines = [];
                const replaceChars = " ".repeat(indentLength);
                for (const line of fileLines) {
                    newFileLines.push(line.replace(/\t/g, replaceChars));
                }
                return newFileLines;
            }
        }
    },

    // Space after catch
    SpaceAfterCatch: {
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

    // Unnecessary def in field declaration (statif def)
    UnnecessaryDefInFieldDeclaration: {
        priority: getPriority("UnnecessaryDefInFieldDeclaration"),
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
        fix: {
            type: "replaceString",
            before: '"{{STRING}}"',
            after: "'{{STRING}}'"
        }
    },

    // Unnecessary semi colon at the end of a line
    UnnecessarySemicolon: {
        priority: getPriority("UnnecessarySemicolon"),
        fix: {
            type: "function",
            func: line => {
                return line.split(";").join("");
            }
        }
    },

    // Trailing Whitespaces
    TrailingWhitespace: {
        priority: getPriority("TrailingWhitespace"),
        fix: {
            type: "function",
            func: line => {
                return line.trimEnd();
            }
        }
    }
};

function getPriority(ruleName) {
    return rulesFixPriorityOrder.indexOf(ruleName);
}

function getVariable(evaluatedVars, name, optns = { mandatory: false, decodeHtml: false, line: "" }) {
    const matchingVars = evaluatedVars.filter(evaluatedVar => evaluatedVar.name === name);
    if (matchingVars && matchingVars.length > 0) {
        return optns.decodeHtml ? decodeHtml(matchingVars[0].value) : matchingVars[0].value;
    } else if (optns.mandatory) {
        throw new Error("NGL fix: missing mandatory variable " + name + " in " + JSON.stringify(evaluatedVars)) + "for line :\n" + optns.line;
    } else {
        return null;
    }
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
