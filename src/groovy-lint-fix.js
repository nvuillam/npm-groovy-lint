#! /usr/bin/env node

// Imports
//const util = require("util");
const fse = require("fs-extra");
const cliProgress = require('cli-progress');
//const os = require("os");
//const xml2js = require("xml2js");
const { npmGroovyLintRules, npmGroovyLintGlobalReplacements } = require("./groovy-lint-rules.js");

class NpmGroovyLintFix {
    "use strict";

    options = {};

    updatedLintResult;
    npmGroovyLintRules;
    fixableErrors = {};
    fixedErrorsNumber = 0;

    bar;
    barTimer;

    // Constructor: initialize options & args
    constructor(lintResult, optionsIn) {
        this.updatedLintResult = lintResult;
        this.options = optionsIn;
        this.verbose = optionsIn.verbose || false;
        // Load fix rules
        this.npmGroovyLintRules = this.options.groovyLintRulesOverride ? require(this.options.groovyLintRulesOverride) : npmGroovyLintRules;
        // Initialize fix counters
        this.updatedLintResult.summary.totalFixedErrorNumber = 0;
        this.updatedLintResult.summary.totalFixedWarningNumber = 0;
        this.updatedLintResult.summary.totalFixedInfoNumber = 0;
    }

    // Fix errors using codenarc result and groovy lint rules
    async run() {
        // Start progress bar
        this.bar = new cliProgress.SingleBar({
            format: 'NGL [{bar}] Fixing {file}',
            clearOnComplete: true
        }, cliProgress.Presets.shades_classic); this.bar.start(Object.keys(this.updatedLintResult.files).length, 0);

        // Parse fixes and process them
        await this.parseFixableErrors();
        await this.fixErrors();

        // Clear progress bar
        this.bar.stop();

        return this;
    }

    // Extract fixable errors from definition file
    async parseFixableErrors() {
        for (const fileNm of Object.keys(this.updatedLintResult.files)) {
            // Progress bar
            this.bar.increment(); this.bar.update(null, { 'file': fileNm });
            // Match found errors and fixable groovy lint rules
            this.fixableErrors[fileNm] = [];
            const fileErrors = this.updatedLintResult.files[fileNm].errors;
            for (const err of fileErrors) {
                if (this.npmGroovyLintRules[err.rule] != null && this.npmGroovyLintRules[err.rule].fixes != null) {
                    const fixableError = {
                        id: err.id,
                        ruleName: err.rule,
                        lineNb: err.line,
                        msg: err.msg,
                        rule: this.npmGroovyLintRules[err.rule]
                    };
                    this.fixableErrors[fileNm].push(fixableError);
                }
            }
            // Sort errors putting scope = file at last
            this.fixableErrors[fileNm].sort((a, b) => {
                if (a.rule.scope && a.rule.scope === "file" && b.rule.scope == null) {
                    return -1;
                } else if (b.rule.scope && b.rule.scope === "file" && a.rule.scope == null) {
                    return 1;
                }
                return 0;
            });
        }
    }

    // Fix errors in files using fix rules
    async fixErrors() {
        // Process files in parallel
        await Promise.all(
            Object.keys(this.fixableErrors).map(async fileNm => {
                // Read file
                let fileContent = await fse.readFile(fileNm);
                let fileLines = fileContent.toString().split("\n");

                // Process fixes
                let fixedInFileNb = 0;
                for (const fileFixableError of this.fixableErrors[fileNm]) {
                    // File scope violation
                    if (fileFixableError.rule.scope === "file") {
                        const fileLinesNew = this.applyFixRule(fileLines, fileFixableError);
                        if (fileLinesNew.toString() !== fileLines.toString()) {
                            fileLines = fileLinesNew;
                            fixedInFileNb = fixedInFileNb + 1;
                            this.fixedErrorsNumber = this.fixedErrorsNumber + 1;
                            this.updateLintResult(fileNm, fileFixableError.id, { fixed: true });
                        }
                    }
                    // Line scope violation
                    else {
                        const lineNb = parseInt(fileFixableError.lineNb, 10) - 1;
                        const line = fileLines[lineNb];
                        const fixedLine = this.applyFixRule(line, fileFixableError);
                        if (fixedLine !== line) {
                            fileLines[lineNb] = fixedLine;
                            fixedInFileNb = fixedInFileNb + 1;
                            this.fixedErrorsNumber = this.fixedErrorsNumber + 1;
                            this.updateLintResult(fileNm, fileFixableError.id, { fixed: true });
                        }
                    }
                }
                // Write new file content if it has been updated
                if (fixedInFileNb) {
                    fse.writeFileSync(fileNm, fileLines.join("\n"));
                }
            })
        );
    }

    // Evaluate variables and apply rule defined fixes
    applyFixRule(line, fixableError) {
        // Evaluate variables from message
        const evaluatedVars = [];
        for (const varDef of fixableError.rule.variables || []) {
            // regex
            if (varDef.regex) {
                const regexRes = fixableError.msg.match(varDef.regex);
                if (regexRes && regexRes.length > 1) {
                    const regexPos = varDef.regexPos || 1;
                    evaluatedVars.push({ name: varDef.name, value: regexRes[regexPos] });
                }
            } else if (varDef.value) {
                evaluatedVars.push({ name: varDef.name, value: varDef.value });
            }
        }

        // Apply replacement
        let newLine = line;
        for (const fix of fixableError.rule.fixes) {
            // Replace String
            if (fix.type === "replaceString") {
                // Replace {{VARNAME}} by real variables
                const strBefore = this.setVariablesValues(fix.before, evaluatedVars.concat(npmGroovyLintGlobalReplacements));
                const strAfter = this.setVariablesValues(fix.after, evaluatedVars.concat(npmGroovyLintGlobalReplacements));
                // Process replacement with evualuated expressions (except if issue in evaluated expression)
                if (!strBefore.includes("{{") && !strAfter.includes("{{")) {
                    newLine = newLine.replace(strBefore, strAfter);
                } else if (this.options.verbose) {
                    console.debug("NGL: missing replacement variable(s):\n" + strBefore + "\n" + strAfter + "\n");
                }
            }
            // Replace regex
            else if (fix.type === "replaceRegex") {
                // Replace {{VARNAME}} by real variables
                const regexBefore = this.setVariablesValues(fix.before, evaluatedVars.concat(npmGroovyLintGlobalReplacements));
                const strAfter = this.setVariablesValues(fix.after, evaluatedVars.concat(npmGroovyLintGlobalReplacements));
                if (!regexBefore.includes("{{") && !strAfter.includes("{{")) {
                    newLine = newLine.replace(new RegExp(regexBefore, "g"), strAfter);
                }
            }
            // Function defined in rule
            else if (fix.type === "function") {
                try {
                    newLine = fix.func(newLine, evaluatedVars);
                } catch (e) {
                    if (this.options.verbose) {
                        console.error("NGL: Function error: " + e.message + " / " + JSON.stringify(fixableError));
                    }
                }
            }
        }

        return newLine;
    }

    // Replace {{VARNAME}} by real variables
    setVariablesValues(str, variables) {
        let newStr = str;
        for (const variable of variables) {
            newStr = newStr.replace(new RegExp("{{" + variable.name + "}}", "g"), variable.value);
        }
        return newStr;
    }

    // Update lint result of an identified error
    updateLintResult(fileNm, errId, errDataToSet) {
        const errIndex = this.updatedLintResult.files[fileNm].errors.findIndex(error => error.id === errId);
        const error = this.updatedLintResult.files[fileNm].errors[errIndex];
        Object.assign(error, errDataToSet);
        this.updatedLintResult.files[fileNm].errors[errIndex] = error;
        if (errDataToSet.fixed === true) {
            switch (error.severity) {
                case "error": this.updatedLintResult.summary.totalFixedErrorNumber++; break;
                case "warning": this.updatedLintResult.summary.totalFixedWarningNumber++; break;
                case "info": this.updatedLintResult.summary.totalFixedInfoNumber++; break;
            }
        }
    }
}

module.exports = NpmGroovyLintFix;
