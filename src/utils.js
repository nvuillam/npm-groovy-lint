// Shared functions
"use strict";

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

// Evaluate variables from messages
function evaluateVariables(variableDefs, msg, optns = { verbose: false }) {
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
            } else if (optns.verbose) {
                console.error("NGL: Unable to match " + varDef.regex + " in " + msg);
            }
        } else if (varDef.value) {
            evaluatedVars.push({ name: varDef.name, value: varDef.value });
        }
    }
    return evaluatedVars;
}

// Get position to highlight in sources
function evaluateRange(errItem, rule, evaluatedVars, errLine, allLines, optns = { verbose: false }) {
    let range;
    if (rule.range) {
        if (rule.range.type === "function") {
            try {
                range = rule.range.func(errLine, errItem, evaluatedVars, allLines);
            } catch (e) {
                if (optns.verbose) {
                    console.error("NGL: Range function error: " + e.message + " / " + JSON.stringify(rule) + "\n" + JSON.stringify(errItem));
                }
            }
        }
    }
    return range;
}

module.exports = { evaluateVariables, getSourceLines, evaluateRange };
