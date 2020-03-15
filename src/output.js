// Output management
const c = require("ansi-colors");
const fse = require("fs-extra");
const path = require("path");

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
        totalRemainingInfoNumber: 0
    };

    for (const fileName of Object.keys(lintResult.files)) {
        const fileResults = lintResult.files[fileName];
        const fileErrors = fileResults.errors || [];

        // Compute Error counters
        const fileFoundErrorsNumber = fileErrors.filter(err => {
            return err.severity === "error";
        }).length;
        const fileFixedErrorsNumber = fileErrors.filter(err => {
            return err.severity === "error" && err.fixed && err.fixed === true;
        }).length;
        const fileRemainingErrorNumber = fileFoundErrorsNumber - fileFixedErrorsNumber;

        counterResultsSummary.totalFoundErrorNumber = counterResultsSummary.totalFoundErrorNumber + fileFoundErrorsNumber;
        counterResultsSummary.totalFixedErrorNumber = counterResultsSummary.totalFixedErrorNumber + fileFixedErrorsNumber;
        counterResultsSummary.totalRemainingErrorNumber = counterResultsSummary.totalRemainingErrorNumber + fileRemainingErrorNumber;

        // Compute Warning counters
        const fileFoundWarningNumber = fileErrors.filter(err => {
            return err.severity === "warning";
        }).length;
        const fileFixedWarningNumber = fileErrors.filter(err => {
            return err.severity === "warning" && err.fixed && err.fixed === true;
        }).length;
        const fileRemainingWarningNumber = fileFoundWarningNumber - fileFixedWarningNumber;

        counterResultsSummary.totalFoundWarningNumber = counterResultsSummary.totalFoundWarningNumber + fileFoundWarningNumber;
        counterResultsSummary.totalFixedWarningNumber = counterResultsSummary.totalFixedWarningNumber + fileFixedWarningNumber;
        counterResultsSummary.totalRemainingWarningNumber = counterResultsSummary.totalRemainingWarningNumber + fileRemainingWarningNumber;

        // Compute Info counters
        const fileFoundInfoNumber = fileErrors.filter(err => {
            return err.severity === "info";
        }).length;
        const fileFixedInfoNumber = fileErrors.filter(err => {
            return err.severity === "info" && err.fixed && err.fixed === true;
        }).length;
        const fileRemainingInfoNumber = fileFoundInfoNumber - fileFixedInfoNumber;

        counterResultsSummary.totalFoundInfoNumber = counterResultsSummary.totalFoundErrorNumber + fileFoundInfoNumber;
        counterResultsSummary.totalFixedInfoNumber = counterResultsSummary.totalFixedInfoNumber + fileFixedInfoNumber;
        counterResultsSummary.totalRemainingInfoNumber = counterResultsSummary.totalRemainingInfoNumber + fileRemainingInfoNumber;

        // Total undepending of severity
        counterResultsSummary.totalFoundNumber =
            counterResultsSummary.totalFoundNumber + fileFoundErrorsNumber + fileFoundWarningNumber + fileFoundInfoNumber;
        counterResultsSummary.totalFixedNumber =
            counterResultsSummary.totalFixedNumber + fileFixedErrorsNumber + fileFixedWarningNumber + fileFixedInfoNumber;
        counterResultsSummary.totalRemainingNumber =
            counterResultsSummary.totalRemainingNumber + fileRemainingErrorNumber + fileRemainingWarningNumber + fileRemainingInfoNumber;
    }

    // Set summary
    lintResult.summary = counterResultsSummary;
    return lintResult;
}

// Reformat output if requested in command line
async function processOutput(outputType, output, lintResult, options, fixer = null) {
    let outputString = "";
    // Display as console log
    if (outputType === "txt") {
        // Disable colors if outputt results in text file or no output result
        if (output.includes(".txt") || output === "none") {
            // Disable ansi colors if output in txt file
            c.enabled = false;
        }
        // Errors
        for (const fileNm of Object.keys(lintResult.files)) {
            const fileErrors = lintResult.files[fileNm].errors;
            outputString += c.underline(fileNm) + "\n";
            for (const err of fileErrors) {
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
        const summaryTable = [errorTableLine, warningTableLine, infoTableLine];

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
            const fullFileContent = JSON.stringify(outputString, null, 2);
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
