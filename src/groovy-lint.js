#! /usr/bin/env node

// Imports
const c = require("ansi-colors");
const fse = require("fs-extra");
const os = require("os");
const path = require("path");
const cliProgress = require("cli-progress");
const util = require("util");
const xml2js = require("xml2js");
const NpmGroovyLintFix = require("./groovy-lint-fix.js");
const { npmGroovyLintRules } = require("./groovy-lint-rules.js");
const optionsDefinition = require("./options");
const { evaluateRange, evaluateVariables, getSourceLines } = require("./utils.js");
class NpmGroovyLint {
    "use strict";

    options = {}; // NpmGroovyLint options
    args = []; // Command line arguments

    // Internal
    jdeployFile;
    jdeployRootPath;
    parseOptions;
    tmpXmlFileName;
    tmpGroovyFileName;

    // Codenarc
    codenarcArgs = [];
    codeNarcBaseDir;
    codeNarcStdOut;
    codeNarcStdErr;

    // npm-groovy-lint
    outputType;
    output;
    onlyCodeNarc = false;
    lintResult = {};
    nglOutputString = "";
    status = 0;
    fixer;

    bar;
    barTimer;

    // Construction: initialize options & args
    constructor(argsIn, internalOpts = { parseOptions: true }) {
        if (argsIn) {
            this.args = argsIn;
        }
        this.jdeployFile = internalOpts.jdeployFile || process.env.JDEPLOY_FILE || "originaljdeploy.js";
        this.jdeployRootPath = internalOpts.jdeployRootPath || process.env.JDEPLOY_ROOT_PATH || __dirname;
        this.parseOptions = internalOpts.parseOptions !== false;
    }

    // Run linting (and fixing if --fix)
    async run() {
        const doProcess = await this.preProcess();
        if (doProcess) {
            await this.callCodeNarc();
            await this.postProcess();
        }
        return this;
    }

    // Call an existing NpmGroovyLint instance to request fix of errors
    async fixErrors(errorIds) {
        this.fixer = new NpmGroovyLintFix(this.lintResult, {
            verbose: this.options.verbose,
            fixrules: this.options.fixrules,
            source: this.options.source,
            save: this.tmpGroovyFileName ? false : true
        });
        await this.fixer.run(errorIds);
        this.lintResult = this.mergeResults(this.lintResult, this.fixer.updatedLintResult);
    }

    // Actions before call to CodeNarc
    async preProcess() {
        // Manage when the user wants to use only codenarc args
        if (Array.isArray(this.args) && this.args.includes("--codenarcargs")) {
            this.codenarcArgs = this.args.slice(2).filter(userArg => userArg !== "--codenarcargs");
            this.onlyCodeNarc = true;
            return true;
        }

        // Parse options ( or force them if coming from lint re-run after fix)
        if (this.parseOptions) {
            try {
                this.options = optionsDefinition.parse(this.args);
            } catch (error) {
                this.status = 2;
                throw new Error(error.message);
            }
        } else {
            this.options = this.args;
        }

        // Show version (TODO: more clean)
        if (this.options.version) {
            console.info("v2.0.0");
            return false;
        }

        // Show help ( index or for an options)
        if (this.options.help) {
            if (this.options._.length) {
                this.nglOutputString = optionsDefinition.generateHelpForOption(this.options._[0]);
            } else {
                this.nglOutputString = optionsDefinition.generateHelp();
            }
            console.info(this.nglOutputString);
            return false;
        }

        ////////////////////////////
        // Build codenarc options //
        ////////////////////////////

        let cnPath = this.options.path;
        let cnFiles = this.options.files;

        // If source option, create a temporary Groovy file
        if (this.options.source) {
            cnPath = os.tmpdir();
            const tmpFileNm = "codeNarcTmpFile_" + Math.random() + ".groovy";
            this.tmpGroovyFileName = os.tmpdir() + "/" + tmpFileNm;
            cnFiles = "**/" + tmpFileNm;
            await fse.writeFile(this.tmpGroovyFileName, this.options.source);
        }

        // Base directory
        const baseBefore = (cnPath !== "." && cnPath.startsWith("/")) || cnPath.includes(":/") || cnPath.includes(":\\") ? "" : process.cwd() + "/";
        this.codeNarcBaseDir = cnPath !== "." ? baseBefore + cnPath.replace(/^"(.*)"$/, "$1") : process.cwd();
        this.codenarcArgs.push('-basedir="' + this.codeNarcBaseDir + '"');

        // Ruleset(s) & matching files pattern
        let defaultFilesPattern = "**/*.groovy,**/Jenkinsfile";
        let ruleSetFile = this.jdeployRootPath + "/lib/example/RuleSet-Groovy.groovy";
        if (this.options.rulesets) {
            if (this.options.rulesets === "Jenkinsfile") {
                defaultFilesPattern = "**/Jenkinsfile";
                ruleSetFile = this.jdeployRootPath + "/lib/example/RuleSet-Jenkinsfile.groovy";
            } else if (this.options.rulesets === "Groovy") {
                defaultFilesPattern = "**/*.groovy";
                ruleSetFile = this.jdeployRootPath + "/lib/example/RuleSet-Groovy.groovy";
            } else if (this.options.rulesets === "all") {
                ruleSetFile = this.jdeployRootPath + "/lib/example/RuleSet-All.groovy";
            } else {
                ruleSetFile = this.options.rulesets.replace(/^"(.*)"$/, "$1");
            }
        }
        this.codenarcArgs.push('-rulesetfiles="file:' + ruleSetFile + '"');

        // Matching files pattern(s)
        if (cnFiles) {
            this.codenarcArgs.push('-includes="' + cnFiles.replace(/^"(.*)"$/, "$1") + '"');
        } else {
            // If files not sent, use defaultFilesPattern, guessed from options.rulesets value
            this.codenarcArgs.push('-includes="' + defaultFilesPattern + '"');
        }

        // Output
        this.output = this.options.output.replace(/^"(.*)"$/, "$1");
        if (this.output.includes(".txt") || this.output === "none") {
            // Disable ansi colors if output in txt file
            c.enabled = false;
        }
        if (["txt", "json", "none"].includes(this.output) || this.output.endsWith(".txt") || this.output.endsWith(".json")) {
            this.outputType = this.output.endsWith(".txt") ? "txt" : this.output.endsWith(".json") ? "json" : this.output;
            this.tmpXmlFileName = os.tmpdir() + "/codeNarcReportXml_" + Math.random() + ".xml";
            this.codenarcArgs.push('-report=xml:"' + this.tmpXmlFileName + '"');
        } else if (["html", "xml"].includes(this.output.split(".").pop())) {
            this.outputType = this.output
                .split(".")
                .pop()
                .endsWith("html")
                ? "html"
                : this.output
                      .split(".")
                      .pop()
                      .endsWith("xml")
                ? "xml"
                : "";
            const ext = this.output.split(".").pop();
            this.codenarcArgs.push('-report="' + ext + ":" + this.output + '"');

            // If filename is sent: just call codeNarc, no parsing results
            if (!["html", "xml"].includes(this.output)) {
                this.onlyCodeNarc = true;
            }
        } else {
            this.status = 2;
            throw new Error("For now, only output formats are txt and json in console, and html and xml as files");
        }

        return true;
    }

    // Call CodeNard java class from renamed jdeploy.js
    async callCodeNarc() {
        // Build jdeploy codenarc command , filter non-codenarc arguments
        const nodeExe = this.args[0] && this.args[0].includes("node") ? this.args[0] : "node";
        const jDeployCommand = '"' + nodeExe + '" "' + this.jdeployRootPath.trim() + "/" + this.jdeployFile + '" ' + this.codenarcArgs.join(" ");

        // Start progress bar
        if (this.options.verbose) {
            console.log("NGL: running CodeNarc with " + this.codenarcArgs.join(" "));
        }
        this.bar = new cliProgress.SingleBar(
            {
                format: "[{bar}] Running CodeNarc for {duration_formatted}",
                hideCursor: true,
                clearOnComplete: true
            },
            cliProgress.Presets.shades_classic
        );
        this.bar.start(10, 1);
        this.barTimer = setInterval(() => {
            this.bar.increment();
            if (this.bar.value === 9) {
                this.bar.update(1);
            }
        }, 500);

        // originalJDeploy.js Execution using child process
        const exec = util.promisify(require("child_process").exec);
        let execRes;
        try {
            execRes = await exec(jDeployCommand);
        } catch (e) {
            clearInterval(this.barTimer);
            this.bar.stop();
            throw new Error("NGL: CodeNarc crash: \n" + e.message);
        }

        // Stop progress bar
        clearInterval(this.barTimer);
        this.bar.stop();

        this.codeNarcStdOut = execRes.stdout;
        this.codeNarcStdErr = execRes.stderr;
    }

    // After CodeNarc call
    async postProcess() {
        // CodeNarc error
        if (this.codeNarcStdErr && this.codeNarcStdErr !== "Picked up _JAVA_OPTIONS: -Xmx512M\n") {
            this.status = 1;
            console.error("NGL: Error running CodeNarc: \n" + this.codeNarcStdErr);
        }
        // no --ngl* options
        else if (this.onlyCodeNarc) {
            console.log("NGL: Successfully processed CodeNarc: \n" + this.codeNarcStdOut);
        }
        // process npm-groovy-lint options ( output, fix, formatting ...)
        else {
            // Parse XML result as js object
            this.lintResult = await this.parseCodeNarcResult();
            // Fix when possible
            if (this.options.fix) {
                this.fixer = new NpmGroovyLintFix(this.lintResult, {
                    verbose: this.options.verbose,
                    fixrules: this.options.fixrules,
                    source: this.options.source,
                    save: this.tmpGroovyFileName ? false : true
                });
                await this.fixer.run();
                this.lintResult = this.fixer.updatedLintResult;
                // If there has been fixes, call CodeNarc again to get updated error list
                if (this.fixer.fixedErrorsNumber > 0) {
                    await this.lintAgainAfterFix();
                }
            }
            // Output result
            await this.processNglOutput();
        }

        // Remove temporary file created for source argument if provided
        if (this.tmpGroovyFileName) {
            await fse.remove(this.tmpGroovyFileName);
        }
    }

    // Parse XML result file as js object
    async parseCodeNarcResult() {
        const parser = new xml2js.Parser();
        const tempXmlFileContent = await parser.parseStringPromise(fse.readFileSync(this.tmpXmlFileName), {});
        if (!tempXmlFileContent || !tempXmlFileContent.CodeNarc || !tempXmlFileContent.CodeNarc.Package) {
            console.error(JSON.stringify(tempXmlFileContent));
            this.status = 3;
            throw new Error("Unable to parse temporary codenarc xml report file " + this.tmpXmlFileName);
        }
        const result = { summary: {} };

        // Parse main result
        const pcgkSummary = tempXmlFileContent.CodeNarc.PackageSummary[0]["$"];
        result.summary.totalFilesWithErrorsNumber = parseInt(pcgkSummary.filesWithViolations, 10);
        result.summary.totalFilesLinted = parseInt(pcgkSummary.totalFiles, 10);
        result.summary.totalErrorNumber = parseInt(pcgkSummary.priority1, 10);
        result.summary.totalWarningNumber = parseInt(pcgkSummary.priority2, 10);
        result.summary.totalInfoNumber = parseInt(pcgkSummary.priority3, 10);

        // Parse files & violations
        const files = {};
        let errId = 0;
        for (const folderInfo of tempXmlFileContent.CodeNarc.Package) {
            if (!folderInfo.File) {
                continue;
            }
            for (const fileInfo of folderInfo.File) {
                // Build file name, or use '0' if source has been sent as input parameter
                const fileNm = this.options.source
                    ? 0
                    : this.codeNarcBaseDir + "/" + (folderInfo["$"].path ? folderInfo["$"].path + "/" : "") + fileInfo["$"].name;
                if (files[fileNm] == null) {
                    files[fileNm] = { errors: [] };
                }
                // Get source code from file or input parameter
                let allLines = await getSourceLines(this.options.source, fileNm);

                for (const violation of fileInfo.Violation) {
                    const errItem = {
                        id: errId,
                        line: violation["$"].lineNumber ? parseInt(violation["$"].lineNumber, 10) : 0,
                        rule: violation["$"].ruleName,
                        severity:
                            violation["$"].priority === "1"
                                ? "error"
                                : violation["$"].priority === "2"
                                ? "warning"
                                : violation["$"].priority === "3"
                                ? "info"
                                : "unknown",
                        msg: violation.Message ? violation.Message[0] : ""
                    };
                    // Find range & add error only if severity is matching logLevel
                    if (
                        errItem.severity === "error" ||
                        this.options.loglevel === "info" ||
                        (this.options.loglevel === "warning" && ["error", "warning"].includes(errItem.severity))
                    ) {
                        // Get fixable info & range if they have been defined on the rule
                        const errRule = npmGroovyLintRules[errItem.rule];
                        if (errRule) {
                            errItem.fixable = errRule.fix ? true : false;
                            if (errRule.range) {
                                const evaluatedVars = evaluateVariables(errRule.variables, errItem.msg, { verbose: this.verbose });
                                const errLine = allLines[errItem.line - 1];
                                const range = evaluateRange(errItem, errRule, evaluatedVars, errLine, allLines, { verbose: this.verbose });
                                if (range) {
                                    errItem.range = range;
                                }
                            }
                        }
                        // Add in file errors
                        files[fileNm].errors.push(errItem);
                        errId++;
                    }
                }
            }
        }
        result.files = files;
        await fse.remove(this.tmpXmlFileName); // Remove temporary file
        return result;
    }

    // Lint again after fixes and merge in existing results
    async lintAgainAfterFix() {
        // same Options except fix = false & output = none
        const lintAgainOptions = JSON.parse(JSON.stringify(this.options));
        if (this.options.source) {
            lintAgainOptions.source = this.lintResult.files[0].updatedSource;
        }
        lintAgainOptions.fix = false;
        lintAgainOptions.output = "none";
        const newLinter = new NpmGroovyLint(lintAgainOptions, {
            parseOptions: false,
            jdeployFile: this.jdeployFile,
            jdeployRootPath: this.jdeployRootPath
        });
        // Run linter
        await newLinter.run();
        const newLintResult = newLinter.lintResult;
        // Merge new linter results in existing results
        this.lintResult = this.mergeResults(this.lintResult, newLintResult);
    }

    // Merge --fix results and following lint results
    mergeResults(initialResults, afterFixResults) {
        const updatedResults = JSON.parse(JSON.stringify(initialResults));

        // Reset properties and update counters
        updatedResults.files = {};
        updatedResults.summary.totalErrorNumber = afterFixResults.summary.totalErrorNumber;
        updatedResults.summary.totalWarningNumber = afterFixResults.summary.totalWarningNumber;
        updatedResults.summary.totalInfoNumber = afterFixResults.summary.totalInfoNumber;
        updatedResults.summary.totalFixedErrorNumber = afterFixResults.summary.totalFixedErrorNumber;
        updatedResults.summary.totalFixedWarningNumber = afterFixResults.summary.totalFixedWarningNumber;
        updatedResults.summary.totalFixedInfoNumber = afterFixResults.summary.totalFixedInfoNumber;

        updatedResults.summary.fixedErrorsNumber = afterFixResults.summary.fixedErrorsNumber;
        updatedResults.summary.fixedErrorsIds = afterFixResults.summary.fixedErrorsIds;

        // Remove not fixed errors from initial result and add remaining errors of afterfixResults
        for (const fileNm of Object.keys(initialResults.files)) {
            const initialResfileErrors = initialResults.files[fileNm].errors;
            const afterFixResfileErrors = afterFixResults.files[fileNm].errors;
            const fileDtl = {
                errors: afterFixResfileErrors,
                updatedSource: afterFixResults.files[fileNm].updatedSource
            };
            for (const initialFileError of initialResfileErrors) {
                if (initialFileError.fixed) {
                    fileDtl.errors.push(initialFileError);
                }
            }
            updatedResults.files[fileNm] = fileDtl;
        }
        return updatedResults;
    }

    // Reformat output if requested in command line
    async processNglOutput() {
        // Display as console log
        if (this.outputType === "txt") {
            // Errors
            for (const fileNm of Object.keys(this.lintResult.files)) {
                const fileErrors = this.lintResult.files[fileNm].errors;
                this.nglOutputString += c.underline(fileNm) + "\n";
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
                        if (this.options.verbose === true) {
                            color = "green";
                            err.severity = "fixed";
                        } else {
                            continue;
                        }
                    }
                    // Build error output line
                    this.nglOutputString +=
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
                this.nglOutputString += "\n";
            }
            this.nglOutputString += "\nnpm-groovy-lint results in " + c.bold(this.lintResult.summary.totalFilesLinted) + " linted files:";

            // Summary table
            const errorTableLine = {
                Severity: "Error",
                "Total found": this.lintResult.summary.totalErrorNumber,
                "Total fixed": this.lintResult.summary.totalFixedErrorNumber,
                "Total remaining": this.lintResult.summary.totalRemainingErrorNumber
            };
            const warningTableLine = {
                Severity: "Warning",
                "Total found": this.lintResult.summary.totalWarningNumber,
                "Total fixed": this.lintResult.summary.totalFixedWarningNumber,
                "Total remaining": this.lintResult.summary.totalRemainingWarningNumber
            };
            const infoTableLine = {
                Severity: "Info",
                "Total found": this.lintResult.summary.totalInfoNumber,
                "Total fixed": this.lintResult.summary.totalFixedInfoNumber,
                "Total remaining": this.lintResult.summary.totalRemainingInfoNumber
            };
            const summaryTable = [errorTableLine, warningTableLine, infoTableLine];

            // Output text log in file or console
            if (this.output.endsWith(".txt")) {
                const fullFileContent = this.nglOutputString;
                fse.writeFileSync(this.output, fullFileContent);
                console.table(summaryTable, this.fixer ? ["Severity", "Total found", "Total fixed", "Total remaining"] : ["Severity", "Total found"]);
                const absolutePath = path.resolve(".", this.output);
                console.info("NGL: Logged results in file " + absolutePath);
            } else {
                console.log(this.nglOutputString);
                console.table(summaryTable, this.fixer ? ["Severity", "Total found", "Total fixed", "Total remaining"] : ["Severity", "Total found"]);
            }
        }
        // Display as json
        else if (this.outputType === "json") {
            // Output log
            if (this.output.endsWith(".json")) {
                const fullFileContent = JSON.stringify(this.nglOutputString, null, 2);
                fse.writeFileSync(this.output, fullFileContent);
                const absolutePath = path.resolve(".", this.output);
                console.info("NGL: Logged results in file " + absolutePath);
            } else {
                this.nglOutputString = JSON.stringify(this.lintResult);
                console.log(this.nglOutputString);
            }
        }
    }
}

module.exports = NpmGroovyLint;
