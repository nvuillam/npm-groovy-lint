#! /usr/bin/env node

// Imports
const fse = require("fs-extra");
const cliProgress = require("cli-progress");
const decodeHtml = require("decode-html");
const { npmGroovyLintRules } = require("./groovy-lint-rules.js");

class NpmGroovyLintFix {
    "use strict";

    options = {};

    updatedLintResult;
    npmGroovyLintRules;
    fixRules = null;
    fixableErrors = {};
    fixedErrorsNumber = 0;

    bar;
    barTimer;

    // Constructor: initialize options & args
    constructor(lintResult, optionsIn) {
        this.updatedLintResult = lintResult;
        this.options = optionsIn;
        this.verbose = optionsIn.verbose || false;
        // Load available fix rules
        this.npmGroovyLintRules = this.options.groovyLintRulesOverride ? require(this.options.groovyLintRulesOverride) : npmGroovyLintRules;
        if (this.options.fixrules !== "all" && this.options.fixrules !== null) {
            this.fixRules = this.options.fixrules.split(",");
        }
        // Initialize fix counters
        this.updatedLintResult.summary.totalFixedErrorNumber = 0;
        this.updatedLintResult.summary.totalFixedWarningNumber = 0;
        this.updatedLintResult.summary.totalFixedInfoNumber = 0;
    }

    // Fix errors using codenarc result and groovy lint rules
    async run() {
        // Start progress bar
        this.bar = new cliProgress.SingleBar(
            {
                format: "NGL [{bar}] Fixing {file}",
                clearOnComplete: true
            },
            cliProgress.Presets.shades_classic
        );
        this.bar.start(Object.keys(this.updatedLintResult.files).length, 0);

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
            this.bar.increment();
            this.bar.update(null, { file: fileNm });
            // Match found errors and fixable groovy lint rules
            this.fixableErrors[fileNm] = [];
            const fileErrors = this.updatedLintResult.files[fileNm].errors;
            for (const err of fileErrors) {
                if (
                    this.npmGroovyLintRules[err.rule] != null &&
                    this.npmGroovyLintRules[err.rule].fix != null &&
                    (this.fixRules == null || this.fixRules.includes(err.rule))
                ) {
                    // Add fixable error
                    const fixableError = {
                        id: err.id,
                        ruleName: err.rule,
                        lineNb: err.line,
                        msg: err.msg,
                        rule: this.npmGroovyLintRules[err.rule]
                    };
                    this.addFixableError(fileNm, fixableError);
                    // Trigger other fixes if defined in the rule
                    if (this.npmGroovyLintRules[err.rule].triggers) {
                        for (const triggeredRuleName of this.npmGroovyLintRules[err.rule].triggers) {
                            const fixableErrorTriggered = {
                                id: err.id + "_triggered",
                                ruleName: triggeredRuleName,
                                lineNb: err.line,
                                msg: err.msg,
                                rule: this.npmGroovyLintRules[triggeredRuleName]
                            };
                            this.addFixableError(fileNm, fixableErrorTriggered);
                        }
                    }
                }
            }

            // Sort errors putting file scope at last, and sorter file scopes by ascending priority
            this.fixableErrors[fileNm].sort((a, b) => {
                return a.rule.priority > b.rule.priority ? 1 : a.rule.priority < b.rule.priority ? -1 : 0;
            });
        }
    }

    // Add fixable error but do not add twice if scope if the full file
    addFixableError(fileNm, fixableError) {
        if (
            fixableError.rule.scope === "file" &&
            !fixableError.rule.unitary === true &&
            this.fixableErrors[fileNm].filter(matchFixableError => matchFixableError.ruleName === fixableError.ruleName).length > 0
        ) {
            return;
        }
        this.fixableErrors[fileNm].push(fixableError);
    }

    // Fix errors in files using fix rules
    async fixErrors() {
        // Process files in parallel
        await Promise.all(
            Object.keys(this.fixableErrors).map(async fileNm => {
                // Read file
                let fileContent = await fse.readFile(fileNm);
                let fileLines = fileContent
                    .toString()
                    .replace(/\r?\n/g, "\r\n")
                    .split("\r\n");

                // Process fixes
                let fixedInFileNb = 0;
                for (const fileFixableError of this.fixableErrors[fileNm]) {
                    if (this.fixRules != null && !this.fixRules.includes(fileFixableError.ruleName)) {
                        continue;
                    }
                    const lineNb = fileFixableError.lineNb ? parseInt(fileFixableError.lineNb, 10) - 1 : -1;
                    // File scope violation
                    if (fileFixableError.rule.scope === "file") {
                        const fileLinesNew = this.tryApplyFixRule(fileLines, lineNb, fileFixableError).slice(); // copy result lines
                        if (JSON.stringify(fileLinesNew) !== JSON.stringify(fileLines.toString)) {
                            fileLines = fileLinesNew;
                            fixedInFileNb = fixedInFileNb + 1;
                            this.fixedErrorsNumber = this.fixedErrorsNumber + 1;
                            this.updateLintResult(fileNm, fileFixableError.id, { fixed: true });
                        }
                    }
                    // Line scope violation
                    else {
                        const line = fileLines[lineNb];
                        const fixedLine = this.tryApplyFixRule(line, lineNb, fileFixableError);
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
                    fse.writeFileSync(fileNm, fileLines.join("\r\n") + "\r\n");
                }
            })
        );
    }

    tryApplyFixRule(line, lineNb, fixableError) {
        try {
            return this.applyFixRule(line, lineNb, fixableError);
        } catch (e) {
            if (this.verbose) {
                console.error(e.message);
                console.error(fixableError);
            }
            return line;
        }
    }

    // Evaluate variables and apply rule defined fixes
    applyFixRule(line, lineNb, fixableError) {
        // Evaluate variables from message
        const evaluatedVars = [];
        for (const varDef of fixableError.rule.variables || []) {
            // regex
            if (varDef.regex) {
                const regexRes = fixableError.msg.match(varDef.regex);
                if (regexRes && regexRes.length > 1) {
                    const regexPos = varDef.regexPos || 1;
                    evaluatedVars.push({ name: varDef.name, value: decodeHtml(regexRes[regexPos]) });
                } else if (this.verbose) {
                    console.error("NGL: Unable to match " + varDef.regex + " in " + fixableError.msg);
                }
            } else if (varDef.value) {
                evaluatedVars.push({ name: varDef.name, value: varDef.value });
            }
        }
        evaluatedVars.push({ name: "lineNb", value: lineNb });

        // Apply fix : replacement or custom function
        let newLine = line;
        const fix = fixableError.rule.fix;
        // Replace String
        if (fix.type === "replaceString") {
            // Replace {{VARNAME}} by real variables
            const strBefore = this.setVariablesValues(fix.before, evaluatedVars);
            const strAfter = this.setVariablesValues(fix.after, evaluatedVars);
            // Process replacement with evualuated expressions (except if issue in evaluated expression)
            if (!strBefore.includes("{{") && !strAfter.includes("{{")) {
                newLine = newLine.replace(strBefore, strAfter);
            } else if (this.verbose) {
                console.error("NGL: missing replacement variable(s):\n" + strBefore + "\n" + strAfter + "\n" + JSON.stringify(fixableError));
            }
        }
        // Function defined in rule
        else if (fix.type === "function") {
            try {
                newLine = fix.func(newLine, evaluatedVars);
            } catch (e) {
                if (this.verbose) {
                    console.error("NGL: Function error: " + e.message + " / " + JSON.stringify(fixableError));
                }
            }
        }
        return newLine;
    }

    // Replace {{VARNAME}} by real variables
    setVariablesValues(str, variables) {
        let newStr = str + "";
        for (const variable of variables) {
            newStr = newStr.replace(new RegExp("{{" + variable.name + "}}", "g"), variable.value);
        }
        return newStr;
    }

    // Update lint result of an identified error
    updateLintResult(fileNm, errId, errDataToSet) {
        const errIndex = this.updatedLintResult.files[fileNm].errors.findIndex(error => error.id === errId);
        if (errIndex < 0) {
            // No error to update in case of fix from triggers of another rule
            return;
        }
        const error = this.updatedLintResult.files[fileNm].errors[errIndex];
        Object.assign(error, errDataToSet);
        this.updatedLintResult.files[fileNm].errors[errIndex] = error;
        if (errDataToSet.fixed === true) {
            switch (error.severity) {
                case "error":
                    this.updatedLintResult.summary.totalFixedErrorNumber++;
                    break;
                case "warning":
                    this.updatedLintResult.summary.totalFixedWarningNumber++;
                    break;
                case "info":
                    this.updatedLintResult.summary.totalFixedInfoNumber++;
                    break;
            }
        }
    }
}

module.exports = NpmGroovyLintFix;
