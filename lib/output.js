// Output management
const c = require("ansi-colors");
const fse = require("fs-extra");
const path = require("path");
const { isErrorInLogLevelScope } = require("./utils");

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
        fixedRules: {}
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
    const fileFoundSeverityNumber = fileErrors.filter(err => {
        return err.severity === severity;
    }).length;
    // Fixed
    const fileFixedSeverityNumber = fileErrors.filter(err => {
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
        remaining: fileRemainingSeverityNumber
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
            c.enabled = false;
        }
        // Errors
        for (const fileNm of Object.keys(lintResult.files)) {
            const fileErrors = lintResult.files[fileNm].errors;
            outputString += c.underline(fileNm) + "\n";
            for (const err of fileErrors) {
                if (!isErrorInLogLevelScope(err.severity, options.loglevel)) {
                    continue;
                }
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
                outputString +=
                    "  " +
                    err.line.toString().padEnd(4, " ") +
                    "  " +
                    c[color](err.severity.padEnd(7, " ")) +
                    "  " +
                    err.msg +
                    "  " +
                    err.rule.padEnd(24, " ") +
                    "\n";
            }
            outputString += "\n";
        }
        outputString += "\nnpm-groovy-lint results in " + c.bold(lintResult.summary.totalFilesLinted) + " linted files:";

        // Summary table
        const errorTableLine = {
            Severity: "Error",
            "Total found": lintResult.summary.totalFoundErrorNumber,
            "Total fixed": lintResult.summary.totalFixedErrorNumber,
            "Total remaining": lintResult.summary.totalRemainingErrorNumber
        };
        const warningTableLine = {
            Severity: "Warning",
            "Total found": lintResult.summary.totalFoundWarningNumber,
            "Total fixed": lintResult.summary.totalFixedWarningNumber,
            "Total remaining": lintResult.summary.totalRemainingWarningNumber
        };
        const infoTableLine = {
            Severity: "Info",
            "Total found": lintResult.summary.totalFoundInfoNumber,
            "Total fixed": lintResult.summary.totalFixedInfoNumber,
            "Total remaining": lintResult.summary.totalRemainingInfoNumber
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
            fse.writeFileSync(output, fullFileContent);
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
            fse.writeFileSync(output, fullFileContent);
            const absolutePath = path.resolve(".", output);
            console.info("GroovyLint: Logged results in file " + absolutePath);
        } else {
            outputString = JSON.stringify(lintResult);
            console.log(outputString);
        }
    }
    return outputString;
}

module.exports = { computeStats, processOutput };
