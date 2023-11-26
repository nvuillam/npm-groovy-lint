// Shared functions
"use strict";

const debug = require("debug")("npm-groovy-lint");
const trace = require("debug")("npm-groovy-lint-trace");
const decodeHtml = require("decode-html");
const fse = require("fs-extra");
const os = require("os");

const validErrorCombinations = {
    error: ["error", "warning", "info"],
    warning: ["warning", "info"],
    info: ["info"],
    none: ["error", "warning", "info"]
};

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
    if (char.length > 1 && !line.includes(char + " ")) {
        return line.replace(char, char + " ");
    }
    let pos = -1;
    const lineIndent = line.search(/\S/);
    const splits = line.split(char);
    const newArray = splits.map(str => {
        pos++;
        if (pos === splits.length - 1) {
            return str.trimStart();
        } else {
            return str.trim();
        }
    });
    return " ".repeat(lineIndent) + newArray.join(char + " ").trimEnd();
}

// Add space around character
function addSpaceAroundChar(line, char, postReplaces = []) {
    let pos = -1;
    // split line by character except when it is inside quotes
    const escapedChar = char.replace(/[-[\]{}()*+!<=:?./\\^$|#\s,]/g, "\\$&");
    //const regSplit = new RegExp(escapedChar + `+(?=(?:(?:[^']*'){2})*[^']*$)`);
    const regSplit = new RegExp(escapedChar + `+(?=(?:(?:[^"]*"){2})*[^"]*$)(?=(?:(?:[^']*'){2})*[^']*$)(?=(?:(?:[^\`]*\`){2})*[^\`]*$)`);
    const splits = line.split(regSplit);
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

// Get position to highlight in sources
function evaluateRangeFromLine(errItem, allLines) {
    return getDefaultRange(allLines, errItem);
}

// escapeMessage escapes a value as retrieved from CodeNarc
// from the "display name" so it matches the original source.
// See issue: https://github.com/CodeNarc/CodeNarc/issues/749
// Escaping as per: https://groovy-lang.org/syntax.html#_escaping_special_characters
function escapeValue(s) {
    return s
        .replace(/\\/g, "\\\\")
        .replace(/[\b]/g, "\\b") // Class so \b is not a word boundary.
        .replace(/\f/g, "\\f")
        .replace(/\n/g, "\\n")
        .replace(/\r/g, "\\r")
        .replace(/\t/g, "\\t")
        .replace(/\v/g, "\\v")
        .replace(/'/g, "\\'")
        .replace(/"/g, '\\"');
}

// Evaluate variables from messages
function evaluateVariables(variableDefs, msg) {
    const evaluatedVars = [];
    for (const varDef of variableDefs || []) {
        // regex
        if (varDef.regex) {
            const regexRes = msg.match(varDef.regex);
            if (regexRes && regexRes.length > 1) {
                const regexPos = varDef.regexPos || 1;
                let value = decodeHtml(regexRes[regexPos]);
                value = escapeValue(value);
                const varValue =
                    varDef.type && varDef.type === "number"
                        ? parseInt(value, 10)
                        : varDef.type && varDef.type === "array"
                        ? JSON.parse(value)
                        : value;
                evaluatedVars.push({
                    name: varDef.name,
                    value: varValue
                });
            } else {
                trace(`GroovyLint: Unable to match ${varDef.regex} in ${msg}`);
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
    let fileContent =
        source ||
        (await fse.readFile(fileNm).catch(err => {
            throw new Error(`Unable to read source lines: ${err}`); // Ensure that we have a stack trace.
        }));
    return normalizeNewLines(fileContent.toString()).split(os.EOL);
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

// Returns true or false depending if a single error level (error, warning, info) is applicable to the logged error level
function isErrorInLogLevelScope(errorLevel, logLevel) {
    return validErrorCombinations[errorLevel].includes(logLevel);
}

function isValidCodeLine(line) {
    return line.trim() !== "" && line.trim().split("//")[0] !== "";
}

// Move the opening bracket at the same position than its related expression
function moveOpeningBracket(allLines, variables) {
    const range = getVariable(variables, "range", { mandatory: true });
    const realPos = allLines[range.end.line - 1].includes("{") ? range.end.line : allLines[range.end.line].includes("{") ? range.end.line + 1 : -1;
    if (realPos === -1) {
        throw new Error("Unable to find opening bracket");
    }
    if (
        allLines[realPos - 1]
            .trim()
            .replace(/ /g, "")
            .includes("){")
    ) {
        throw new Error("Fix not applied: probably a CodeNarc false positive");
    }
    // Add bracket after if
    const addedBracketLine = allLines[realPos - 2].trimEnd() + " {";
    allLines[realPos - 2] = addedBracketLine;
    // Remove bracket which was on the wrong line
    const removedBracketLine = allLines[realPos - 1].substring(allLines[realPos - 1].indexOf("{") + 1).trimEnd();
    allLines[realPos - 1] = removedBracketLine;
    // Remove removed bracket line if empty
    if (allLines[realPos - 1].trim() === "") {
        allLines.splice(realPos - 1, 1);
    }
    return allLines;
}

function normalizeNewLines(str) {
    let normalizedString = str + "";
    normalizedString = str.replace(/\r/g, "");
    normalizedString = normalizedString.replace(/\n/g, os.EOL);
    return normalizedString;
}

// Utils of utils :)

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

function containsExceptInsideString(line, subString) {
    const subStringPos = line.indexOf(subString);
    if (subStringPos === -1) {
        return false;
    }
    const lineWithoutQuotedStuff = line.replace(/(["'])(?:(?=(\\?))\2.)*?\1/g, ""); // Remove content inside quotes
    return lineWithoutQuotedStuff.includes(subString);
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

function getNpmGroovyLintVersion() {
    let v = process.env.npm_package_version;
    if (!v) {
        try {
            const FindPackageJson = require("find-package-json");
            const finder = FindPackageJson(__dirname);
            v = finder.next().value.version;
        } catch {
            v = "error";
        }
    }
    return v;
}

module.exports = {
    addImport,
    addSpaceAfterChar,
    addSpaceAroundChar,
    containsOtherThan,
    containsExceptInsideString,
    evaluateRange,
    evaluateRangeFromLine,
    evaluateVariables,
    findRangeBetweenStrings,
    getIndentLength,
    getLastStringRange,
    getNpmGroovyLintVersion,
    getOutOfBracesStrings,
    getSourceLines,
    getStringRange,
    getStringRangeMultiline,
    getVariable,
    getVariableRange,
    isErrorInLogLevelScope,
    isValidCodeLine,
    moveOpeningBracket,
    normalizeNewLines
};
