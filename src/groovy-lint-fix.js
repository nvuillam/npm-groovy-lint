#! /usr/bin/env node

// Imports
const fse = require("fs-extra");
const cliProgress = require("cli-progress");
const debug = require("debug")("npm-groovy-lint");
const { getNpmGroovyLintRules } = require("./groovy-lint-rules.js");
const { evaluateVariables, getSourceLines } = require("./utils.js");

class NpmGroovyLintFix {
    "use strict";

    options = {};

    updatedLintResult;
    npmGroovyLintRules;
    fixRules = null;
    fixableErrors = {};
    fixedErrorsNumber = 0;
    fixedErrorsIds = [];

    bar;
    barTimer;

    // Constructor: initialize options & args
    constructor(lintResult, optionsIn) {
        this.updatedLintResult = JSON.parse(JSON.stringify(lintResult)); // Clone object to not compare the initial one
        this.options = optionsIn;
        this.verbose = optionsIn.verbose || false;
        // Load available fix rules
        this.npmGroovyLintRules = this.options.groovyLintRulesOverride ? require(this.options.groovyLintRulesOverride) : getNpmGroovyLintRules();
        if (this.options.fixrules && this.options.fixrules !== "all") {
            this.fixRules = this.options.fixrules.split(",");
        }
    }

    // Fix errors using codenarc result and groovy lint rules
    async run(optns = { errorIds: null, propagate: false }) {
        debug(`<<<<<< NpmGroovyLintFix.run START >>>>>>`);
        // Start progress bar
        this.bar = new cliProgress.SingleBar(
            {
                format: "GroovyLint [{bar}] Fixing {file}",
                clearOnComplete: true
            },
            cliProgress.Presets.shades_classic
        );
        this.bar.start(Object.keys(this.updatedLintResult.files).length, 0);

        // Parse fixes and process them
        await this.parseFixableErrors(optns.errorIds);
        await this.fixErrors(optns.propagate);

        // Clear progress bar
        this.bar.stop();
        debug(`>>>>>> NpmGroovyLintFix.run END <<<<<<`);
        return this;
    }

    // Extract fixable errors from definition file
    async parseFixableErrors(errorIds) {
        for (const fileNm of Object.keys(this.updatedLintResult.files)) {
            // Progress bar
            this.bar.increment();
            this.bar.update(null, { file: fileNm });
            // Match found errors and fixable groovy lint rules
            this.fixableErrors[fileNm] = [];
            const fileErrors = this.updatedLintResult.files[fileNm].errors;
            for (const err of fileErrors) {
                if (
                    (errorIds == null || errorIds.includes(err.id)) &&
                    this.npmGroovyLintRules[err.rule] != null &&
                    this.npmGroovyLintRules[err.rule].fix != null &&
                    (this.fixRules == null || this.fixRules.includes(err.rule) || this.fixRules[0] === "TriggerTestError")
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
        debug(`Parsed fixable errors: ${JSON.stringify(this.fixableErrors)}`);
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
                let allLines = await getSourceLines(this.options.source, fileNm);

                // Process fixes
                let fixedInFileNb = 0;
                for (const fileFixableError of this.fixableErrors[fileNm]) {
                    if (this.fixRules != null && !this.fixRules.includes(fileFixableError.ruleName) && this.fixRules[0] !== "TriggerTestError") {
                        continue;
                    }
                    const lineNb = fileFixableError.lineNb ? parseInt(fileFixableError.lineNb, 10) - 1 : -1;
                    // File scope violation
                    if (fileFixableError.rule.scope === "file") {
                        const allLinesNew = this.tryApplyFixRule([...allLines], lineNb, fileFixableError).slice(); // copy result lines
                        if (JSON.stringify(allLinesNew) !== JSON.stringify(allLines)) {
                            fixedInFileNb = fixedInFileNb + 1;
                            this.fixedErrorsNumber = this.fixedErrorsNumber + 1;
                            this.fixedErrorsIds.push(fileFixableError.id);
                            this.updateLintResult(fileNm, fileFixableError.id, { fixed: true });
                            allLines = allLinesNew;
                        }
                    }
                    // Line scope violation
                    else {
                        const line = allLines[lineNb];
                        const fixedLine = this.tryApplyFixRule(line, lineNb, fileFixableError);
                        if (fixedLine !== line) {
                            allLines[lineNb] = fixedLine;
                            fixedInFileNb = fixedInFileNb + 1;
                            this.fixedErrorsNumber = this.fixedErrorsNumber + 1;
                            this.fixedErrorsIds.push(fileFixableError.id);
                            this.updateLintResult(fileNm, fileFixableError.id, { fixed: true });
                        }
                    }
                }
                const newSources = allLines.join("\r\n") + "\r\n";
                this.updatedLintResult.files[fileNm].updatedSource = newSources;
                // Write new file content if it has been updated
                if (this.options.save && fixedInFileNb > 0) {
                    fse.writeFileSync(fileNm, newSources);
                }
            })
        );
    }

    tryApplyFixRule(line, lineNb, fixableError) {
        try {
            return this.applyFixRule(line, lineNb, fixableError);
        } catch (e) {
            if (this.verbose) {
                debug(e.message);
                debug(fixableError);
            }
            return line;
        }
    }

    // Evaluate variables and apply rule defined fixes
    applyFixRule(line, lineNb, fixableError) {
        // Evaluate variables from message
        const evaluatedVars = evaluateVariables(fixableError.rule.variables, fixableError.msg, { verbose: this.verbose });
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
            } else {
                debug("GroovyLint: missing replacement variable(s):\n" + strBefore + "\n" + strAfter + "\n" + JSON.stringify(fixableError));
            }
        }
        // Function defined in rule
        else if (fix.type === "function") {
            try {
                if (this.fixRules && this.fixRules[0] === "TriggerTestError") {
                    throw new Error("Trigger test error");
                }
                newLine = fix.func(newLine, evaluatedVars);
            } catch (e) {
                debug("GroovyLint: Function error: " + e.message + " / " + JSON.stringify(fixableError));
                throw e;
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
        // Update error in lint result {mostly fixed: true}
        // It not in list of errors, it means it's from a triggered error
        if (errIndex > -1) {
            const error = this.updatedLintResult.files[fileNm].errors[errIndex];
            Object.assign(error, errDataToSet);
            this.updatedLintResult.files[fileNm].errors[errIndex] = error;
        }
    }
}

module.exports = NpmGroovyLintFix;
