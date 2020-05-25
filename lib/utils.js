// Shared functions
"use strict";

const debug = require("debug")("npm-groovy-lint");
const decodeHtml = require("decode-html");
const fse = require("fs-extra");

function addImport(allLineLs, classToImport) {
    // Check if import is already there
    if (allLineLs.map(line => line.trim()).findIndex(line => line.startsWith(`import ${classToImport}`)) > -1) {
        return allLineLs;
    }
    // Add import after existing imports
    const lastImportIndex =
        allLineLs.length -
        1 -
        allLineLs
            .slice()
            .reverse()
            .findIndex(line => line.trim().startsWith("import"));
    if (lastImportIndex > -1 && lastImportIndex !== allLineLs.length) {
        allLineLs.splice(lastImportIndex + 1, 0, `import ${classToImport}`);
        return allLineLs;
    }
    // Add import after package declaration
    const packageIndex = allLineLs.findIndex(line => line.trim().startsWith("package"));
    if (packageIndex > -1) {
        allLineLs.splice(packageIndex + 1, 0, "");
        allLineLs.splice(packageIndex + 2, 0, `import ${classToImport}`);
        return allLineLs;
    }
    // Add import at the first line not containing comments and after package if here
    let addImportLinePos = 0;
    for (let i = 0; i < allLineLs.length; i++) {
        const line = allLineLs[i];
        if (line.trim().startsWith("#") || line.trim().startsWith("/")) {
            addImportLinePos = i + 1;
            continue;
        }
        break;
    }
    allLineLs.splice(addImportLinePos, 0, `import ${classToImport}`);
    if (addImportLinePos === 0) {
        allLineLs.splice(addImportLinePos + 1, 0, "");
    }
    return allLineLs;
}

// Add space after a string in another string
function addSpaceAfterChar(line, char) {
    let pos = -1;
    const lineIndent = line.search(/\S/);
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
    return " ".repeat(lineIndent) + newArray.join(char + " ").trimEnd();
}

// Add space around an expression
function addSpaceAroundChar(line, char, postReplaces = []) {
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
    line = newArray.join(" " + char + " ").trimEnd();
    // If exceptions, repair the broken string :)
    if (postReplaces && postReplaces.length > 0) {
        for (const postReplace of postReplaces) {
            line = line.replace(postReplace[0], postReplace[1]);
        }
    }
    return line;
}

// Checks that a string contains other things than a list of strings
function containsOtherThan(str, stringArray) {
    const splits = splitMulti(str, stringArray);
    return splits.filter(item => item !== "").length > 0;
}

// Get position to highlight in sources
function evaluateRange(errItem, rule, evaluatedVars, errLine, allLines) {
    let range;
    if (rule.range) {
        if (rule.range.type === "function") {
            try {
                range = rule.range.func(errLine, errItem, evaluatedVars, allLines);
            } catch (e) {
                debug("GroovyLint: Range function error: " + e.message + " / " + JSON.stringify(rule) + "\n" + JSON.stringify(errItem));
            }
        }
    }
    return range;
}

// Evaluate variables from messages
function evaluateVariables(variableDefs, msg) {
    const evaluatedVars = [];
    for (const varDef of variableDefs || []) {
        // regex
        if (varDef.regex) {
            msg = msg.replace(/\n/g, "\\n").replace(/\r/g, "\\r");
            const regexRes = msg.match(varDef.regex);
            if (regexRes && regexRes.length > 1) {
                const regexPos = varDef.regexPos || 1;
                const value = decodeHtml(regexRes[regexPos]);
                evaluatedVars.push({
                    name: varDef.name,
                    value: varDef.type && varDef.type === "number" ? parseInt(value, 10) : value
                });
            } else {
                debug("GroovyLint: Unable to match " + varDef.regex + " in " + msg);
            }
        }
    }
    return evaluatedVars;
}

// Find the range between two strings (included)
function findRangeBetweenStrings(allLines, errItem, strStart, strEnd) {
    let range = getDefaultRange(allLines, errItem);
    let pos = errItem.line - 1;
    let isStartFound = false;
    let isEndFound = false;
    while ((isStartFound === false || isEndFound === false) && pos < allLines.length) {
        if (!isStartFound && allLines[pos].indexOf(strStart) > -1 && notBetweenQuotesOrComment(allLines[pos], strStart)) {
            range.start = { line: pos + 1, character: allLines[pos].indexOf(strStart) };
            isStartFound = true;
        }
        if (
            !isEndFound &&
            allLines[pos].indexOf(strEnd) > -1 &&
            (strStart !== strEnd || pos > range.start.line - 1) &&
            notBetweenQuotesOrComment(allLines[pos], strEnd)
        ) {
            range.end = { line: pos + 1, character: allLines[pos].indexOf(strEnd) };
            isEndFound = true;
        }
        pos++;
    }
    return range;
}

// Returns default range (all line)
function getDefaultRange(allLines, errItem) {
    return {
        start: { line: errItem.line, character: 0 },
        end: { line: errItem.line, character: allLines[errItem.line - 1].length }
    };
}

// Get indent length
function getIndentLength() {
    return 4;
}

// Get range of the last occurrence of a substring in a string
function getLastStringRange(errLine, str, errItem) {
    const varStartPos = errLine.lastIndexOf(str);
    return {
        start: { line: errItem.line, character: varStartPos },
        end: { line: errItem.line, character: varStartPos + str.length }
    };
}

/*
function getLastVariableRange(errLine, evaluatedVars, variable, errItem) {
    const varValue = getVariable(evaluatedVars, variable);
    return getLastStringRange(errLine, varValue, errItem);
}
*/

// Returns all strings which are not inside braces
function getOutOfBracesStrings(str, exclude = []) {
    let match = false;
    let pos = 0;
    let level = 0;
    const outOfBracesStrings = [];
    while (!match && pos < str.length) {
        if (str[pos] === "(") {
            level++;
            if (level === 1 && outOfBracesStrings.length === 0) {
                outOfBracesStrings.push(str.substr(0, pos).trim());
            }
        }
        if (str[pos] === ")") {
            level--;
            if (level === 0 && outOfBracesStrings.length === 1) {
                outOfBracesStrings.push(str.substr(pos + 1).trim());
                match = true;
            }
        }
        pos++;
    }
    return outOfBracesStrings.filter(item => !exclude.includes(item) && item !== "");
}

// Split source lines to analyse
async function getSourceLines(source, fileNm) {
    let fileContent = source || (await fse.readFile(fileNm));
    return fileContent
        .toString()
        .replace(/\r?\n/g, "\r\n")
        .split("\r\n");
}

// Get range of the first occurrence of a substring or regex in a string
function getStringRange(errLine, strOrRegex, errItem) {
    // Regex matcher
    if (strOrRegex instanceof RegExp) {
        const match = strOrRegex.exec(errLine);
        return {
            start: {
                line: errItem.line,
                character: strOrRegex.lastIndex - match[0].length
            },
            end: {
                line: errItem.line,
                character: strOrRegex.lastIndex - 1
            }
        };
    }
    // String matcher
    const varStartPos = errLine.indexOf(strOrRegex);
    return {
        start: {
            line: errItem.line,
            character: varStartPos
        },
        end: {
            line: errItem.line,
            character: varStartPos + strOrRegex.length
        }
    };
}

// Get range of the first occurrence of a substring or regex in a multiline string
function getStringRangeMultiline(allLines, str, errItem, levelKey) {
    let range = getDefaultRange(allLines, errItem);
    let pos = errItem.line - 1;
    let isFound = false;
    let level = 0;
    while (isFound === false && pos < allLines.length) {
        if (levelKey && allLines[pos].indexOf(levelKey) > -1 && notBetweenQuotesOrComment(allLines[pos], levelKey)) {
            level = level + 1;
        }
        if (!isFound && allLines[pos].indexOf(str) > -1 && notBetweenQuotesOrComment(allLines[pos], str)) {
            if (level === 1) {
                const varStartPos = allLines[pos].indexOf(str);
                range = {
                    start: { line: pos + 1, character: varStartPos },
                    end: { line: pos + 1, character: varStartPos + str.length }
                };
                isFound = true;
            } else {
                level = level - 1;
            }
        }
        pos++;
    }
    return range;
}

// Get variable value from evaluated vars
function getVariable(evaluatedVars, name, optns = { mandatory: true, decodeHtml: false, line: "" }) {
    const matchingVars = evaluatedVars.filter(evaluatedVar => evaluatedVar.name === name);
    if (matchingVars && matchingVars.length > 0) {
        return optns.decodeHtml ? decodeHtml(matchingVars[0].value) : matchingVars[0].value;
    } else if (optns.mandatory) {
        throw new Error("GroovyLint fix: missing mandatory variable " + name + " in " + JSON.stringify(evaluatedVars)) + "for line :\n" + optns.line;
    } else {
        return null;
    }
}

// Get range of a variable value in a string
function getVariableRange(errLine, evaluatedVars, variable, errItem) {
    const varValue = getVariable(evaluatedVars, variable);
    return getStringRange(errLine, varValue, errItem);
}

function isValidCodeLine(line) {
    return line.trim() !== "" && line.trim().split("//")[0] !== "";
}

// Move the opening bracket at the same position than its related expression
function moveOpeningBracket(allLines, variables) {
    const range = getVariable(variables, "range", { mandatory: true });
    // Add bracket after if
    const addedBracketLine = allLines[range.end.line - 2].trimEnd() + " {";
    allLines[range.end.line - 2] = addedBracketLine;
    // Remove bracket which was on the wrong line
    const removedBracketLine = allLines[range.end.line - 1].substring(allLines[range.end.line - 1].indexOf("{") + 1).trimEnd();
    allLines[range.end.line - 1] = removedBracketLine;
    // Remove removed bracket line if empty
    if (allLines[range.end.line - 1].trim() === "") {
        allLines.splice(range.end.line - 1, 1);
    }
    return allLines;
}

// Check if a substring is between quotes in a string
function notBetweenQuotesOrComment(str, substr) {
    const singleQuotesMatch = str.match(/'(.*?)'/) || [];
    const doubleQuotesMatch = str.match(/"(.*?)"/) || [];
    const res = singleQuotesMatch.concat(doubleQuotesMatch).filter(match => match.includes(substr));
    if (res.length > 0) {
        return false;
    }
    const splitComments = str.split("//");
    if (splitComments.length > 1 && splitComments[1].includes(substr)) {
        return false;
    }
    if (str.includes("/*")) {
        return false;
    }
    return true;
}

// Split with multiple characters
function splitMulti(str, tokens) {
    var tempChar = tokens[0]; // We can use the first token as a temporary join character
    for (var i = 1; i < tokens.length; i++) {
        str = str.split(tokens[i]).join(tempChar);
    }
    str = str.split(tempChar);
    return str;
}

module.exports = {
    addImport,
    addSpaceAfterChar,
    addSpaceAroundChar,
    containsOtherThan,
    evaluateRange,
    evaluateVariables,
    findRangeBetweenStrings,
    getIndentLength,
    getLastStringRange,
    getOutOfBracesStrings,
    getSourceLines,
    getStringRange,
    getStringRangeMultiline,
    getVariable,
    getVariableRange,
    isValidCodeLine,
    moveOpeningBracket
};
