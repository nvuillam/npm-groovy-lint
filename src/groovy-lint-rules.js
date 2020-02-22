// List fixable CodeNarc rules
"use strict";

const decodeHtml = require("decode-html");

// Default indent length
const indentLength = 4;

// If you add a new global rule, it's very important to think about their order.
// Rules modifiyng the number of lines must arrive last !
const globalScopePriorityOrder = [
    "NoTabCharacter",
    "IfStatementBraces",
    "ElseStatementBraces",
    "IndentationClosingBraces",
    "ClosingBraceNotAlone",
    "ConsecutiveBlankLines",
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
                for (let i = 0; i < fileLines.length; i++) {
                    let line = fileLines[i];
                    const lineTrim = line.trim();
                    // Detect not alone closing brace
                    if (
                        lineTrim.endsWith("}") &&
                        !lineTrim.endsWith("{}") &&
                        !lineTrim.endsWith("{ }") &&
                        !line
                            .slice((line.length !== 1) ? (line.lastIndexOf("}") + 1) : 0)
                            .trim()
                            .startsWith("//")
                    ) {
                        // Is not a closing brace with comment
                        // Remove brace at its position
                        const bracePos = line.lastIndexOf("}");
                        const maxIndex = bracePos == 0 ? 0 : bracePos;
                        line = line.substring(0, maxIndex) + line.substring(bracePos + 1, line.length);
                        newFileLines.push(line.trimEnd());
                        // Add a closing brace in a new line with correct indent
                        const indent = " ".repeat(line.search(/\S|$/) - 1);
                        newFileLines.push((indent + "}").replace(/[\r\n]+/gm, ""));
                    } else {
                        newFileLines.push(line.replace(/[\r\n]+/gm, ""));
                    }
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
                for (const line of fileLines) {
                    if (line.trim() !== "" &&
                        !(newFileLines.length > 0 && newFileLines[newFileLines.length - 1].trim() === "")) {
                        // Check if previous line is empty: if not do not add line
                        newFileLines.push(line);
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
                return (fileLines.join("\n") + "\n").split("\n");
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
                // If line
                let line = fileLines[lineNumber];
                line = line.trimEnd() + " {";
                fileLines[lineNumber] = line;
                // Next line
                let nextLine = fileLines[lineNumber + 1];
                nextLine = nextLine + " }";
                fileLines[lineNumber + 1] = nextLine;
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
                // If line
                let line = fileLines[lineNumber];
                line = line.trimEnd() + " {";
                fileLines[lineNumber] = line;
                // Next line
                let nextLine = fileLines[lineNumber + 1];
                nextLine = nextLine + " }";
                fileLines[lineNumber + 1] = nextLine;
                return fileLines;
            }
        }
    },

    // Indentation
    Indentation: {
        triggers: ["IndentationClosingBraces", "IndentationComments", "ClosingBraceNotAlone"],
        variables: [
            {
                name: "EXPECTED",
                regex: /The (.*) in class (.*) is at the incorrect indent level: Expected column (.*) but was (.*)/,
                regexPos: 3
            },
            {
                name: "FOUND",
                regex: /The (.*) in class (.*) is at the incorrect indent level: Expected column (.*) but was (.*)/,
                regexPos: 4
            }
        ],
        fix: {
            type: "function",
            func: (line, evaluatedVars) => {
                const expectedIndent = parseInt(getVariable(evaluatedVars, "EXPECTED", { mandatory: true, line: line }), 10);
                const foundIndent = parseInt(getVariable(evaluatedVars, "FOUND", { mandatory: true, line: line }));
                if (line.trim() === "}") {
                    // Manage Wrong info from codeNarc :/ {
                    line = line.replace(" ".repeat(foundIndent - 1), " ".repeat(expectedIndent + indentLength * 2));
                } else {
                    line = line.replace(" ".repeat(foundIndent - 1), " ".repeat(expectedIndent - 1));
                }
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
                                nextLineIndent = fileLines[i + j].search(/\S/);
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
                    let line = fileLines[i];
                    // Detect closing brace line
                    if (line.trim() == "}") {
                        // Find indentation of matching brace (CodeNarc Indentation rule does not work well :/ )
                        let j = 1;
                        let matchingLineIndent = null;
                        let level = 0;
                        while (fileLines[i - j] && matchingLineIndent == null) {
                            const prevLine = fileLines[i - j];
                            if (prevLine.includes("}")) {
                                level++;
                            }
                            if (prevLine.includes("{")) {
                                if (level === 0) {
                                    matchingLineIndent = prevLine.search(/\S/);
                                } else {
                                    level--;
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
                for (const line of fileLines) {
                    newFileLines.push(line.replace(/\t/g, ""));
                }
                return newFileLines;
            }
        }
    },

    // Space after catch
    SpaceAfterCatch: {
        fix: {
            type: "replaceString",
            before: "){",
            after: ") {"
        }
    },

    // Space after opening brace
    SpaceAfterOpeningBrace: {
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
                return addSpaceAroundChar(line, operator);
            }
        }
    },

    // Add space after a comma
    SpaceAfterComma: {
        fix: {
            type: "function",
            func: line => {
                return addSpaceAroundChar(line, ",");
            }
        }
    },

    // Space before opening brace
    SpaceBeforeOpeningBrace: {
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
        fix: {
            type: "replaceString",
            before: "static def ",
            after: "static "
        }
    },

    // Unnecessary Groovy String
    UnnecessaryGString: {
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

    // Unnecessary public declaration (public is by default)
    UnnecessaryPublicModifier: {
        fix: {
            type: "replaceString",
            before: "public ",
            after: ""
        }
    },

    // Unnecessary semi colon at the end of a line
    UnnecessarySemicolon: {
        fix: {
            type: "function",
            func: line => {
                const pos = line.lastIndexOf(";");
                if (pos === line.length - 1) {
                    return line.slice(0, -1).trimEnd();
                } else {
                    return (line.slice(0, pos) + line.slice(pos + 1)).trimEnd();
                }
            }
        }
    },

    // Trailing Whitespaces
    TrailingWhitespace: {
        fix: {
            type: "function",
            func: line => {
                return line.trimEnd();
            }
        }
    }
};

function getPriority(ruleName) {
    return globalScopePriorityOrder.indexOf(ruleName);
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

function addSpaceAroundChar(line, char) {
    let pos = 0;
    const splits = line.split(char);
    const newArray = splits.map(str => {
        pos++;
        if (pos === 1) {
            return str.trimEnd();
        } else if (pos === splits.length) {
            return str.trimStart();
        } else {
            return str.trim();
        }
    });
    return newArray.join(" " + char + " ");
}

module.exports = { npmGroovyLintRules };
