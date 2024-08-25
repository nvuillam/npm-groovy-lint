// Output management
import ansiColors from "ansi-colors";
import fs from "fs-extra";
import { SarifBuilder, SarifRunBuilder, SarifResultBuilder, SarifRuleBuilder } from "node-sarif-builder";
import * as path from "path";
import { isErrorInLogLevelScope, getNpmGroovyLintVersion } from "./utils.js";

// Compute statistics for output
function computeStats(lintResult) {
    const counterResultsSummary = {
        totalFoundNumber: 0,
        totalFixedNumber: 0,
        totalRemainingNumber: 0,

        totalFoundErrorNumber: 0,
        totalFoundWarningNumber: 0,
        totalFoundInfoNumber: 0,
        totalFixedErrorNumber: 0,
        totalFixedWarningNumber: 0,
        totalFixedInfoNumber: 0,
        totalRemainingErrorNumber: 0,
        totalRemainingWarningNumber: 0,
        totalRemainingInfoNumber: 0,

        detectedRules: {},
        fixedRules: {},
    };

    // No files = no result (mostly happens when lint has been cancelled before being completed)
    if (lintResult.files == null) {
        return lintResult;
    }

    for (const fileName of Object.keys(lintResult.files)) {
        const fileResults = lintResult.files[fileName];
        const fileErrors = fileResults.errors || [];

        const fileErrorStats = appendErrorTypeStats("error", fileErrors, counterResultsSummary);
        const fileWarningStats = appendErrorTypeStats("warning", fileErrors, counterResultsSummary);
        const fileInfoStats = appendErrorTypeStats("info", fileErrors, counterResultsSummary);

        // Total ignoring severity
        counterResultsSummary.totalFoundNumber =
            counterResultsSummary.totalFoundNumber + fileErrorStats.found + fileWarningStats.found + fileInfoStats.found;
        counterResultsSummary.totalFixedNumber =
            counterResultsSummary.totalFixedNumber + fileErrorStats.fixed + fileWarningStats.fixed + fileInfoStats.fixed;
        counterResultsSummary.totalRemainingNumber =
            counterResultsSummary.totalRemainingNumber + fileErrorStats.remaining + fileWarningStats.remaining + fileInfoStats.remaining;
    }

    // Set summary
    lintResult.summary = Object.assign(lintResult.summary || {}, counterResultsSummary);
    return lintResult;
}

// Collect stats about errors in a linted / formatted / fixed file
function appendErrorTypeStats(severity, fileErrors, counterResultsSummary) {
    // Found
    const fileFoundSeverityNumber = fileErrors.filter((err) => {
        return err.severity === severity;
    }).length;
    // Fixed
    const fileFixedSeverityNumber = fileErrors.filter((err) => {
        return err.severity === severity && err.fixed && err.fixed === true;
    }).length;
    // Remaining
    const fileRemainingSeverityNumber = fileFoundSeverityNumber - fileFixedSeverityNumber;

    // Add counters for each problem type
    for (const err of fileErrors) {
        if (err.severity === severity) {
            counterResultsSummary.detectedRules[err.rule] = counterResultsSummary.detectedRules[err.rule]
                ? counterResultsSummary.detectedRules[err.rule] + 1
                : 1;
            if (err.fixed && err.fixed === true) {
                counterResultsSummary.fixedRules[err.rule] = counterResultsSummary.fixedRules[err.rule]
                    ? counterResultsSummary.fixedRules[err.rule] + 1
                    : 1;
            }
        }
    }

    // Update summary & build result
    const severityCapital = `${severity[0].toUpperCase()}${severity.slice(1)}`;
    const totalFoundKey = `totalFound${severityCapital}Number`;
    const totalFixedKey = `totalFixed${severityCapital}Number`;
    const totalRemainingKey = `totalRemaining${severityCapital}Number`;
    counterResultsSummary[totalFoundKey] = counterResultsSummary[totalFoundKey] + fileFoundSeverityNumber;
    counterResultsSummary[totalFixedKey] = counterResultsSummary[totalFixedKey] + fileFixedSeverityNumber;
    counterResultsSummary[totalRemainingKey] = counterResultsSummary[totalRemainingKey] + fileRemainingSeverityNumber;
    return {
        found: fileFoundSeverityNumber,
        fixed: fileFixedSeverityNumber,
        remaining: fileRemainingSeverityNumber,
    };
}

// Reformat output if requested in command line
async function processOutput(outputType, output, lintResult, options, fixer = null) {
    let outputString = "";
    // Display as console log
    if (outputType === "txt") {
        // Disable colors if output results in text file or no output result
        if (output.includes(".txt") || output === "none") {
            // Disable ansi colors if output in txt file
            ansiColors.enabled = false;
        }
        // Errors
        for (const fileNm of Object.keys(lintResult.files)) {
            const fileErrors = lintResult.files[fileNm].errors;
            let fileOutputString = ansiColors.underline(fileNm) + "\n";
            let showFileInOutput = false;
            for (const err of fileErrors) {
                if (!isErrorInLogLevelScope(err.severity, options.loglevel)) {
                    continue;
                }
                showFileInOutput = true;
                let color = "grey";
                switch (err.severity) {
                    case "error":
                        color = "red";
                        break;
                    case "warning":
                        color = "yellow";
                        break;
                    case "info":
                        color = "grey";
                        break;
                }
                // Display fixed errors only if --verbose is called
                if (err.fixed === true) {
                    if (options.verbose === true) {
                        color = "green";
                        err.severity = "fixed";
                    } else {
                        continue;
                    }
                }
                // Build error output line
                fileOutputString +=
                    "  " +
                    err.line.toString().padEnd(4, " ") +
                    "  " +
                    ansiColors[color](err.severity.padEnd(7, " ")) +
                    "  " +
                    err.msg +
                    "  " +
                    err.rule.padEnd(24, " ") +
                    "\n";
            }
            fileOutputString += "\n";
            if (showFileInOutput || options.verbose) {
                outputString += fileOutputString;
            }
        }
        outputString += "\nnpm-groovy-lint results in " + ansiColors.bold(lintResult.summary.totalFilesLinted) + " linted files:";

        // Summary table
        const errorTableLine = {
            Severity: "Error",
            "Total found": lintResult.summary.totalFoundErrorNumber,
            "Total fixed": lintResult.summary.totalFixedErrorNumber,
            "Total remaining": lintResult.summary.totalRemainingErrorNumber,
        };
        const warningTableLine = {
            Severity: "Warning",
            "Total found": lintResult.summary.totalFoundWarningNumber,
            "Total fixed": lintResult.summary.totalFixedWarningNumber,
            "Total remaining": lintResult.summary.totalRemainingWarningNumber,
        };
        const infoTableLine = {
            Severity: "Info",
            "Total found": lintResult.summary.totalFoundInfoNumber,
            "Total fixed": lintResult.summary.totalFixedInfoNumber,
            "Total remaining": lintResult.summary.totalRemainingInfoNumber,
        };
        const summaryTable = [];
        if (isErrorInLogLevelScope("error", options.loglevel)) {
            summaryTable.push(errorTableLine);
        }
        if (isErrorInLogLevelScope("warning", options.loglevel)) {
            summaryTable.push(warningTableLine);
        }
        if (isErrorInLogLevelScope("warning", options.loglevel)) {
            summaryTable.push(infoTableLine);
        }

        // Output text log in file
        if (output.endsWith(".txt")) {
            const fullFileContent = outputString;
            fs.writeFileSync(output, fullFileContent);
            console.table(summaryTable, fixer ? ["Severity", "Total found", "Total fixed", "Total remaining"] : ["Severity", "Total found"]);
            const absolutePath = path.resolve(".", output);
            console.info("GroovyLint: Logged results in file " + absolutePath);
        } else {
            // Output text log in console
            console.log(outputString);
            console.table(summaryTable, fixer ? ["Severity", "Total found", "Total fixed", "Total remaining"] : ["Severity", "Total found"]);
        }
    }
    // Display as json
    else if (outputType === "json") {
        // Output log
        if (output.endsWith(".json")) {
            const fullFileContent = JSON.stringify(lintResult, null, 2);
            fs.writeFileSync(output, fullFileContent);
            const absolutePath = path.resolve(".", output);
            console.info("GroovyLint: Logged results in file " + absolutePath);
        } else {
            outputString = JSON.stringify(lintResult);
            console.log(outputString);
        }
    }
    // SARIF results
    else if (outputType === "sarif") {
        const sarifJsonString = buildSarifResult(lintResult);
        // SARIF file
        if (output.endsWith(".sarif")) {
            fs.writeFileSync(output, sarifJsonString);
            const absolutePath = path.resolve(".", output);
            outputString = "GroovyLint: Logged SARIF results in file " + absolutePath;
            console.info(outputString);
        } else {
            // SARIF in stdout
            outputString = sarifJsonString;
            console.log(sarifJsonString);
        }
    }
    // stdout result for format / fix with source sent as stdin
    else if (outputType === "stdout") {
        console.log(lintResult.files[0].updatedSource);
    }
    return outputString;
}

function buildSarifResult(lintResult) {
    // SARIF builder
    const sarifBuilder = new SarifBuilder();
    // SARIF Run builder
    const sarifRunBuilder = new SarifRunBuilder().initSimple({
        toolDriverName: "npm-groovy-lint",
        toolDriverVersion: getNpmGroovyLintVersion(),
        url: "https://nvuillam.github.io/npm-groovy-lint/",
    });
    // SARIF rules
    for (const ruleId of Object.keys(lintResult.rules || {})) {
        const rule = lintResult.rules[ruleId];
        const sarifRuleBuilder = new SarifRuleBuilder().initSimple({
            ruleId: ruleId,
            shortDescriptionText: rule.description,
            helpUri: rule.docUrl,
        });
        sarifRunBuilder.addRule(sarifRuleBuilder);
    }
    // Add SARIF results (individual errors)
    for (const fileNm of Object.keys(lintResult.files)) {
        const fileErrors = lintResult.files[fileNm].errors;
        for (const err of fileErrors) {
            const sarifResultBuilder = new SarifResultBuilder();
            const sarifResultInit = {
                level: err.severity === "info" ? "note" : err.severity, // Other values can be "warning" or "error"
                messageText: err.msg,
                ruleId: err.rule,
                fileUri: process.env.SARIF_URI_ABSOLUTE ? "file:///" + fileNm.replace(/\\/g, "/") : path.relative(process.cwd(), fileNm),
            };
            if (err && err.range && err.range.start && (err.range.start.line === 0 || err.range.start.line > 0)) {
                sarifResultInit.startLine = fixLine(err.range.start.line);
                sarifResultInit.startColumn = fixCol(err.range.start.character);
                sarifResultInit.endLine = fixLine(err.range.end.line);
                sarifResultInit.endColumn = fixCol(err.range.end.character);
            }
            sarifResultBuilder.initSimple(sarifResultInit);
            sarifRunBuilder.addResult(sarifResultBuilder);
        }
    }
    sarifBuilder.addRun(sarifRunBuilder);
    return sarifBuilder.buildSarifJsonString({ indent: false });
}

function fixLine(val) {
    if (val === null) {
        return undefined;
    }
    return val === 0 ? 1 : val;
}

function fixCol(val) {
    if (val === null) {
        return undefined;
    }
    return val === 0 ? 1 : val + 1;
}

export { computeStats, processOutput };
