#! /usr/bin/env node
"use strict";

// Shared functions

const debug = require("debug")("npm-groovy-lint");
const decodeHtml = require("decode-html");
const fse = require("fs-extra");

// Split source lines to analyse
async function getSourceLines(source, fileNm) {
    let fileContent = source || (await fse.readFile(fileNm));
    return fileContent
        .toString()
        .replace(/\r?\n/g, "\r\n")
        .split("\r\n");
}

// Get indent length
function getIndentLength() {
    return 4;
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

function getStringRange(errLine, str, errItem) {
    const varStartPos = errLine.indexOf(str);
    return {
        start: { line: errItem.line, character: varStartPos },
        end: { line: errItem.line, character: varStartPos + str.length }
    };
}

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

/*
function getLastVariableRange(errLine, evaluatedVars, variable, errItem) {
    const varValue = getVariable(evaluatedVars, variable);
    return getLastStringRange(errLine, varValue, errItem);
}
*/

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
        if (!isEndFound && allLines[pos].indexOf(strEnd) > -1 && notBetweenQuotesOrComment(allLines[pos], strEnd)) {
            range.end = { line: pos + 1, character: allLines[pos].indexOf(strEnd) };
            isEndFound = true;
        }
        pos++;
    }
    return range;
}

function getDefaultRange(allLines, errItem) {
    return {
        start: { line: errItem.line, character: 0 },
        end: { line: errItem.line, character: allLines[errItem.line - 1].length }
    };
}

function isValidCodeLine(line) {
    return line.trim() !== "" && line.trim().split("//")[0] !== "";
}

function addSpaceAfterChar(line, char) {
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
    return newArray.join(char + " ").trimEnd();
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

module.exports = {
    addSpaceAfterChar,
    addSpaceAroundChar,
    evaluateRange,
    evaluateVariables,
    findRangeBetweenStrings,
    getIndentLength,
    getLastStringRange,
    getSourceLines,
    getStringRange,
    getStringRangeMultiline,
    getVariable,
    getVariableRange,
    isValidCodeLine
};
