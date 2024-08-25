// Imports
import fs from "fs-extra";
import * as cliProgress from "cli-progress";
import Debug from "debug";
const debug = Debug("npm-groovy-lint");
const trace = Debug("npm-groovy-lint-trace");
import * as os from "os";
import { getNpmGroovyLintRules, getFormattingRulesToAlwaysRun } from "./groovy-lint-rules.js";
import { evaluateVariables, getSourceLines } from "./utils.js";

export class NpmGroovyLintFix {
    options = {};

    updatedLintResult;
    npmGroovyLintRules;
    origin = "unknown";
    format = false;
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
        if (this.options.fixrules && this.options.fixrules !== "all") {
            this.fixRules = this.options.fixrules.split(",");
        }
        this.format = optionsIn.format === true;
        this.origin = optionsIn.origin || this.origin;
    }

    // Fix errors using codenarc result and groovy lint rules
    async run(optns = { errorIds: null, propagate: false }) {
        debug(`<<<<<< NpmGroovyLintFix.run START >>>>>>`);
        const npmGroovyLintRules = await getNpmGroovyLintRules();
        this.npmGroovyLintRules = this.options.groovyLintRulesOverride ? await import(this.options.groovyLintRulesOverride) : npmGroovyLintRules;
        // Start progress bar
        this.bar = new cliProgress.SingleBar(
            {
                format: "GroovyLint [{bar}] Fixing {file}",
                clearOnComplete: true,
            },
            cliProgress.Presets.shades_classic,
        );
        this.bar.start(Object.keys(this.updatedLintResult.files).length, 0, { file: "..." });

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
                        range: err.range,
                        rule: Object.assign(
                            this.npmGroovyLintRules[err.rule],
                            this.options.rules && this.options.rules[err.rule] && typeof this.options.rules[err.rule] === "object"
                                ? { config: this.options.rules[err.rule] }
                                : { config: {} },
                        ),
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
                                range: err.range,
                                rule: Object.assign(
                                    this.npmGroovyLintRules[triggeredRuleName],
                                    this.options.rules &&
                                        this.options.rules[triggeredRuleName] &&
                                        typeof this.options.rules[triggeredRuleName] === "object"
                                        ? { config: this.options.rules[triggeredRuleName] }
                                        : { config: {} },
                                ),
                            };
                            this.addFixableError(fileNm, fixableErrorTriggered);
                        }
                    }
                }
            }
            // Add formatting rules to always run if we are in format mode, or if we want to fix all errors
            if (this.format || this.fixRules == null) {
                const formattingRulesToAlwaysRun = getFormattingRulesToAlwaysRun();
                for (const formattingRuleName of formattingRulesToAlwaysRun) {
                    const rule = this.npmGroovyLintRules[formattingRuleName];
                    const fixableErrorTriggered = {
                        id: "format_triggered",
                        ruleName: formattingRuleName,
                        lineNb: 0,
                        msg: `${formattingRuleName} triggered by format request`,
                        rule: rule,
                    };
                    this.addFixableError(fileNm, fixableErrorTriggered);
                }
            }

            // Sort errors putting file scope at last, and sorter file scopes by ascending priority
            this.fixableErrors[fileNm].sort((a, b) => {
                return a.rule.priority > b.rule.priority ? 1 : a.rule.priority < b.rule.priority ? -1 : 0;
            });
        }
        trace(`Parsed fixable errors: ${JSON.stringify(this.fixableErrors)}`);
    }

    // Add fixable error but do not add twice if scope if the full file
    addFixableError(fileNm, fixableError) {
        if (
            fixableError.rule.scope === "file" &&
            !fixableError.rule.unitary === true &&
            this.fixableErrors[fileNm].filter((matchFixableError) => matchFixableError.ruleName === fixableError.ruleName).length > 0
        ) {
            return;
        }
        // Update Fixrules if triggered error
        if (
            this.fixRules != null &&
            typeof fixableError.id === "string" &&
            fixableError.id.includes("_triggered") &&
            !this.fixRules.includes(fixableError.ruleName)
        ) {
            this.fixRules.push(fixableError.ruleName);
        }
        this.fixableErrors[fileNm].push(fixableError);
    }

    // Fix errors in files using fix rules
    async fixErrors() {
        // Process files in parallel
        await Promise.all(
            Object.keys(this.fixableErrors).map(async (fileNm) => {
                // Read file
                let allLines = await getSourceLines(this.options.source, fileNm);

                // Process fixes
                let fixedInFileNb = 0;
                for (let i = 0; i < this.fixableErrors[fileNm].length; i++) {
                    // Do not use for-of as content can change during the loops
                    const fileFixableError = this.fixableErrors[fileNm][i];
                    if (this.fixRules != null && !this.fixRules.includes(fileFixableError.ruleName) && this.fixRules[0] !== "TriggerTestError") {
                        continue;
                    }
                    const lineNb = fileFixableError.lineNb ? parseInt(fileFixableError.lineNb, 10) - 1 : -1;
                    let fixSuccess = false;
                    // File scope violation
                    if (fileFixableError.rule.scope === "file") {
                        const allLinesNew = this.tryApplyFixRule([...allLines], lineNb, fileFixableError, fileNm).slice(); // copy result lines
                        if (JSON.stringify(allLinesNew) !== JSON.stringify(allLines)) {
                            fixSuccess = true;
                            this.updateNextErrorsRanges(allLines, allLinesNew, fileFixableError.lineNb, fileNm);
                            allLines = allLinesNew;
                            debug(`Fixed ${fileFixableError.ruleName} in file ${fileNm}`);
                        } else {
                            debug(`Skipping ${fileFixableError.ruleName} as no change in file ${fileNm}`);
                        }
                    }
                    // Line scope violation
                    else {
                        const line = allLines[lineNb];
                        const fixedLine = this.tryApplyFixRule(line, lineNb, fileFixableError, fileNm);
                        if (fixedLine !== line) {
                            fixSuccess = true;
                            allLines[lineNb] = fixedLine;
                        } else {
                            debug(`Skipping ${fileFixableError.ruleName} as no change in line: ${line}`);
                        }
                    }
                    // Update lint results
                    const fixedNb = this.updateLintResult(
                        fileNm,
                        fileFixableError.id,
                        {
                            fixed: fixSuccess === true,
                            triggersAgainAfterFix: fileFixableError.rule.triggersAgainAfterFix,
                        },
                        fileFixableError.rule.fixesSameErrorOnSameLine,
                    );
                    fixedInFileNb = fixedInFileNb + fixedNb;
                }
                const newSources = allLines.join(os.EOL);
                this.updatedLintResult.files[fileNm].updatedSource = newSources;
                // Write new file content if it has been updated
                if (this.options.save && fixedInFileNb > 0) {
                    fs.writeFileSync(fileNm, newSources);
                }
            }),
        );
    }

    // Try to apply fix rule, return original line if error
    tryApplyFixRule(lineOrAllLines, lineNb, fixableError, fileNm) {
        try {
            return this.applyFixRule(lineOrAllLines, lineNb, fixableError);
        } catch (e) {
            debug(e.message);
            debug(fixableError);
            this.updateLintResult(
                fileNm,
                fixableError.id,
                {
                    fixed: false,
                    triggersAgainAfterFix: fixableError.rule.triggersAgainAfterFix,
                },
                fixableError.rule.fixesSameErrorOnSameLine,
            );
            return lineOrAllLines;
        }
    }

    // Evaluate variables and apply rule defined fixes
    applyFixRule(line, lineNb, fixableError) {
        // Evaluate variables from message
        const evaluatedVars = evaluateVariables(fixableError.rule.variables, fixableError.msg, { verbose: this.verbose });
        evaluatedVars.push({ name: "lineNb", value: lineNb });
        evaluatedVars.push({ name: "range", value: fixableError.range || {} });

        // Apply fix : replacement or custom function
        let newLine = line;
        const fix = fixableError.rule.fix;
        // Replace String
        if (fix.type === "replaceString") {
            // Replace {{VARNAME}} by real variables
            const strBefore = this.setVariablesValues(fix.before, evaluatedVars);
            const strAfter = this.setVariablesValues(fix.after, evaluatedVars);
            // Process replacement with evaluated expressions (except if issue in evaluated expression)
            if (strBefore instanceof RegExp || (!strBefore.includes("{{") && !strAfter.includes("{{"))) {
                newLine = newLine.replace(strBefore, strAfter);
            } else {
                trace(`GroovyLint: missing replacement variable(s):\n${strBefore}\n${strAfter}\n${JSON.stringify(fixableError)}`);
            }
        }
        // Function defined in rule
        else if (fix.type === "function") {
            try {
                if (this.fixRules && this.fixRules[0] === "TriggerTestError") {
                    throw new Error("ERROR: Trigger test error (on purpose)");
                }
                newLine = fix.func(newLine, evaluatedVars, fixableError);
            } catch (e) {
                trace(`ERROR: Fix function error: ${e.message} / ${JSON.stringify(fixableError)}`);
                throw e;
            }
        } else {
            debug(`Fix type not supported: ${fix.type} / ${JSON.stringify(fixableError)}`);
        }
        return newLine;
    }

    // Replace {{VARNAME}} by real variables
    setVariablesValues(strOrRegex, variables) {
        if (strOrRegex instanceof RegExp) {
            return strOrRegex;
        }
        let newStr = strOrRegex + "";
        for (const variable of variables) {
            newStr = newStr.replace(new RegExp("{{" + variable.name + "}}", "g"), variable.value);
        }
        return newStr;
    }

    // Update lint result of an identified error
    updateLintResult(fileNm, errId, errDataToSet, fixesSameErrorOnSameLine = false) {
        const errIndex = this.updatedLintResult.files[fileNm].errors.findIndex((error) => error.id === errId);
        // Update error in lint result {mostly fixed: true}
        // It not in list of errors, it means it's from a triggered error
        let error = {};
        if (errIndex > -1) {
            error = this.updatedLintResult.files[fileNm].errors[errIndex];
            Object.assign(error, errDataToSet);
            // If same error has been fixed on the same line, mark failed fix and success as it has been corrected by a previous fix
            if (fixesSameErrorOnSameLine && errDataToSet.fixed === false) {
                const sameLineSameRuleFixedErrors = this.updatedLintResult.files[fileNm].errors.filter((err) => {
                    return err.line === error.line && err.rule === error.rule && err.fixed === true && err.id !== error.id;
                });
                if (sameLineSameRuleFixedErrors.length > 0) {
                    error.fixed = true;
                }
            }
            this.updatedLintResult.files[fileNm].errors[errIndex] = error;
        }
        if (errDataToSet.fixed === true || error.fixed === true) {
            this.fixedErrorsNumber = this.fixedErrorsNumber + 1;
            this.fixedErrorsIds.push(errId);
            return 1;
        } else {
            return 0;
        }
    }

    // Update line number & calculated range for following errors
    updateNextErrorsRanges(allLines, allLinesNew, lineNb, fileNm) {
        const lengthDiff = allLinesNew.length - allLines.length;
        // If same length, range & lineNb do not need to be updated
        if (lengthDiff === 0) {
            return;
        }
        this.fixableErrors[fileNm] = this.fixableErrors[fileNm].map((fixableError) => {
            // Only update line number & range for next lines
            if (fixableError.lineNb > lineNb) {
                fixableError.lineNb = fixableError.lineNb + lengthDiff;
                if (fixableError.range) {
                    fixableError.range = {
                        start: {
                            line: fixableError.range.start.line + lengthDiff,
                            character: fixableError.range.start.character,
                        },
                        end: {
                            line: fixableError.range.end.line + lengthDiff,
                            character: fixableError.range.end.character,
                        },
                    };
                }
            }
            return fixableError;
        });
    }
}
