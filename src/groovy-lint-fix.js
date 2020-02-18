#! /usr/bin/env node

// Imports
//const util = require("util");
const fse = require("fs-extra");
//const os = require("os");
//const xml2js = require("xml2js");
const { npmGroovyLintRules, npmGroovyLintGlobalReplacements } = require("./groovy-lint-rules.js");

class NpmGroovyLintFix {
    "use strict";

    options = {};

    codeNarcResult;
    npmGroovyLintRules;
    fixableErrors = [];
    fixedErrorsNumber = 0;

    // Construction: initialize options & args
    constructor(codeNarcResultIn, optionsIn) {
        this.codeNarcResult = codeNarcResultIn;
        this.options = optionsIn;
        this.npmGroovyLintRules = this.options.groovyLintRulesOverride ? require(this.options.groovyLintRulesOverride) : npmGroovyLintRules;
    }

    async run() {
        await this.parseFixableErrors();
        await this.fixErrors();
        return this;
    }

    // Extract fixable errors from definition file
    async parseFixableErrors() {
        for (const fileNm of Object.keys(this.codeNarcResult.files)) {
            const fileErrors = this.codeNarcResult.files[fileNm].errors;
            for (const err of fileErrors) {
                if (this.npmGroovyLintRules[err.rule] != null && this.npmGroovyLintRules[err.rule].fixable === true) {
                    const fixableError = {
                        file: fileNm,
                        ruleName: err.rule,
                        lineNb: err.line,
                        msg: err.msg,
                        rule: this.npmGroovyLintRules[err.rule]
                    };
                    this.fixableErrors.push(fixableError);
                }
            }
        }
    }

    // Fix errors in files using fix rules
    async fixErrors() {
        for (const fixableError of this.fixableErrors) {
            let jdeployFileContent = await fse.readFile(fixableError.file);
            const fileLines = jdeployFileContent.toString().split("\n");
            const lineNb = parseInt(fixableError.lineNb, 10) - 1;
            const line = fileLines[lineNb];
            const fixedLine = this.applyFixRule(line, fixableError);
            if (fixedLine !== line) {
                fileLines[lineNb] = fixedLine;
                this.fixedErrorsNumber++;
                await fse.writeFile(fixableError.file, fileLines.join("\n"));
                if (this.options.debug) {
                    console.debug('NGL before: ' + line);
                    console.debug('NGL after : ' + fixedLine);
                }
            }
        }
    }

    // Extract info from error message
    applyFixRule(line, fixableError) {

        // Extract data from message
        const evaluatedVars = [];
        for (const varDef of fixableError.rule.variables) {
            // regex
            if (varDef.regex) {
                const regexRes = fixableError.msg.match(varDef.regex);
                if (regexRes && regexRes.length > 1) {
                    const regexPos = varDef.regexPos || 1;
                    evaluatedVars.push({ name: varDef.name, value: regexRes[regexPos] });
                }
                else {
                    console.debug('NGL: Extract regex error: ' + varDef.regex + ' on ' + fixableError.msg);
                }
            } else if (varDef.value) {
                evaluatedVars.push({ name: varDef.name, value: varDef.value });
            }
        }

        // Apply replacement
        let newLine = line;
        for (const replacement of fixableError.rule.replacements) {
            // Replace String
            if (replacement.type === "replaceString") {
                // Replace {{VARNAME}} by real variables
                const strBefore = this.setVariablesValues(replacement.before, evaluatedVars.concat(npmGroovyLintGlobalReplacements));
                const strAfter = this.setVariablesValues(replacement.after, evaluatedVars.concat(npmGroovyLintGlobalReplacements));
                // Process replacement with evualuated expressions (except if issue in evaluated expression)
                if (!strBefore.includes("{{") && !strAfter.includes("{{")) {
                    newLine = newLine.replace(strBefore, strAfter);
                }
            }
            // Replace regex
            else if (replacement.type === "replaceRegex") {
                // Replace {{VARNAME}} by real variables
                const regexBefore = this.setVariablesValues(replacement.before, evaluatedVars.concat(npmGroovyLintGlobalReplacements));
                const strAfter = this.setVariablesValues(replacement.after, evaluatedVars.concat(npmGroovyLintGlobalReplacements));
                if (!regexBefore.includes("{{") && !strAfter.includes("{{")) {
                    newLine = newLine.replace(new RegExp(regexBefore, 'g'), strAfter);
                }
            }
        }

        return newLine;
    }

    // Replace {{VARNAME}} by real variables
    setVariablesValues(str, variables) {
        let newStr = str;
        for (const variable of variables) {
            newStr = newStr.replace(new RegExp("{{" + variable.name + "}}", 'g'), variable.value);
        }
        return newStr;
    }
}

module.exports = NpmGroovyLintFix;
