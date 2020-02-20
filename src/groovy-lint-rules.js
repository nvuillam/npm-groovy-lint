// List fixable CodeNarc rules
"use strict";

const decodeHtml = require('decode-html');

const npmGroovyLintRules = {
    // Consecutive blank lines
    ConsecutiveBlankLines: {
        scope: "file",
        priority: 999,
        fix: {
            type: "function",
            func: fileLines => {
                const newFileLines = [];
                for (const line of fileLines) {
                    if (line.trim() === "") {
                        // Check if previous line is empty: if not, add empty line
                        if (!(newFileLines.length > 0 && newFileLines[newFileLines.length - 1].trim() === "")) {
                            newFileLines.push("");
                        }
                    } else {
                        newFileLines.push(line);
                    }
                }
                return newFileLines;
            }
        }
    },

    /* nvuillam: Not working, especially when embedded missing If statements ... 
       let's let people correct that manually for now :)
    // Missing if braces
    IfStatementBraces: {
        scope: "file",
        priority: 1,
        fix: {
            type: "function",
            func: (fileLines, variables) => {
                const lineNumber = getVariable(variables, 'lineNb', { mandatory: true });
                fileLines[lineNumber - 1] = fileLines[lineNumber - 1] + ' {';
                fileLines[lineNumber] = fileLines[lineNumber] + ' }';
                return fileLines;
            }
        }
    },
    */

    // Indentation
    Indentation: {
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
                const expectedIndent = parseInt(getVariable(evaluatedVars, "EXPECTED", { mandatory: true }), 10);
                const foundIndent = parseInt(getVariable(evaluatedVars, "FOUND", { mandatory: true }));
                if (line.trim() === "}") {
                    // Manage Wrong info from codeNarc :/ {
                    line = line.replace(" ".repeat(foundIndent - 1), " ".repeat((expectedIndent - 1) * 2));
                } else {
                    line = line.replace(" ".repeat(foundIndent - 1), " ".repeat(expectedIndent - 1));
                }
                return line;
            }
        }
    },

    // No tab character
    NoTabCharacter: {
        scope: "file",
        priority: 2,
        fix: {
            type: "function",
            func: fileLines => {
                const newFileLines = [];
                for (const line of fileLines) {
                    newFileLines.push(line.replace('\t', ''));
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
                    line = line.replace(regexMatch[0], '{ ' + regexMatch[0][0]);
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
                let operator = getVariable(evaluatedVars, "OPERATOR", { mandatory: true, htmlToString: true });
                return addSpaceAroundChar(line, operator);
            }
        }
    },

    // Add space after a comma
    SpaceAfterComma: {
        fix: {
            type: "function",
            func: (line) => {
                return addSpaceAroundChar(line, ',');
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
                    line = line.replace(regexMatch[0], regexMatch[0][0] + ' {');
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
                if (pos === (line.length - 1)) {
                    return line.slice(0, -1).trimEnd();
                }
                else {
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

function getVariable(evaluatedVars, name, optns = { mandatory: false, decodeHtml: false }) {
    const matchingVars = evaluatedVars.filter(evaluatedVar => evaluatedVar.name === name);
    if (matchingVars && matchingVars.length > 0) {
        return (optns.decodeHtml) ? (decodeHtml(matchingVars[0].value)) : matchingVars[0].value;
    } else if (optns.mandatory) {
        throw new Error("NGL fix: missing mandatory variable " + name + " in " + JSON.stringify(evaluatedVars));
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
