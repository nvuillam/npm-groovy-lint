#! /usr/bin/env node

// Imports
const c = require("ansi-colors");
const fse = require("fs-extra");
const os = require("os");
const cliProgress = require("cli-progress");
const util = require("util");
const xml2js = require("xml2js");
const NpmGroovyLintFix = require("./groovy-lint-fix.js");
const optionsDefinition = require("./options");

class NpmGroovyLint {
    "use strict";

    options = {}; // NpmGroovyLint options
    args = []; // Command line arguments

    // Internal
    jdeployFile;
    jdeployRootPath;
    tmpXmlFileName;

    // Codenarc
    codenarcArgs = [];
    codeNarcBaseDir;
    codeNarcStdOut;
    codeNarcStdErr;

    // npm-groovy-lint
    onlyCodeNarc = false;
    lintResult = {};
    nglOutputString = "";
    status = 0;
    fixer;

    bar;
    barTimer;

    // Construction: initialize options & args
    constructor(argsIn, internalOpts = {}) {
        if (argsIn) {
            this.args = argsIn;
        }
        this.jdeployFile = internalOpts.jdeployFile || process.env.JDEPLOY_FILE || "originaljdeploy.js";
        this.jdeployRootPath = internalOpts.jdeployRootPath || process.env.JDEPLOY_ROOT_PATH || __dirname;
        this.tmpXmlFileName = internalOpts.tmpXmlFileName || os.tmpdir() + "/CodeNarcReportXml_" + Math.random() + ".xml";
    }

    async run() {
        const doProcess = await this.preProcess();
        if (doProcess) {
            await this.callCodeNarc();
            await this.postProcess();
        }
        return this;
    }

    // Actions before call to CodeNarc
    async preProcess() {
        // Manage when the user wants to use only codenarc args
        if (this.args.includes("--codenarcargs")) {
            this.codenarcArgs = this.args.slice(2).filter(userArg => userArg !== "--codenarcargs");
            this.onlyCodeNarc = true;
            return true;
        }

        // Parse options
        try {
            this.options = optionsDefinition.parse(this.args);
        } catch (error) {
            this.status = 2;
            throw new Error(error.message);
        }

        // Show version (to do more clean)
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

        // Complete options

        // Build codenarc options
        // base directory
        this.codeNarcBaseDir = this.options.path != "." ? process.cwd() + "/" + this.options.path.replace(/^"(.*)"$/, "$1") : process.cwd();
        this.codenarcArgs.push('-basedir="' + this.codeNarcBaseDir + '"');
        // Matching files pattern(s)
        this.codenarcArgs.push('-includes="' + this.options.files.replace(/^"(.*)"$/, "$1") + '"');
        // Ruleset(s)
        if (this.options.rulesets) {
            this.codenarcArgs.push('-rulesetfiles="file:' + this.options.rulesets.replace(/^"(.*)"$/, "$1") + '"');
        }

        const output = this.options.output.replace(/^"(.*)"$/, "$1");
        if (["txt", "json"].includes(output)) {
            this.codenarcArgs.push('-report=xml:"' + this.tmpXmlFileName + '"');
        } else if (["html", "xml"].includes(output.split(".").pop())) {
            const ext = output.split(".").pop();
            this.codenarcArgs.push('-report="' + ext + ":" + output + '"');
        } else {
            this.status = 2;
            throw new Error("For now, only output formats are txt and json in console, and html and xml as files");
        }

        return true;
    }

    // Call CodeNard java class from renamed jdeploy.js
    async callCodeNarc() {
        // Build jdeploy codenarc command , filter non-codenarc arguments
        const jDeployCommand = '"' + this.args[0] + '" "' + this.jdeployRootPath.trim() + "/" + this.jdeployFile + '" ' + this.codenarcArgs.join(" ");

        // Start progress bar
        if (this.options.verbose) {
            console.log("Running CodeNarc with arguments " + this.codenarcArgs.join(" "));
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
            await this.parseCodeNarcResult();
            // Fix when possible
            if (this.options.fix) {
                this.fixer = new NpmGroovyLintFix(this.lintResult, { verbose: this.options.verbose });
                await this.fixer.run();
                this.lintResult = this.fixer.updatedLintResult;
            }
            // Output result
            await this.processNglOutput();
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
                const fileNm = this.codeNarcBaseDir + "/" + (folderInfo["$"].path ? folderInfo["$"].path + "/" : "") + fileInfo["$"].name;
                if (files[fileNm] == null) {
                    files[fileNm] = { errors: [] };
                }
                for (const violation of fileInfo.Violation) {
                    const err = {
                        id: errId,
                        line: violation["$"].lineNumber,
                        rule: violation["$"].ruleName,
                        severity:
                            violation["$"].priority == "1"
                                ? "error"
                                : violation["$"].priority == "2"
                                ? "warning"
                                : violation["$"].priority == "3"
                                ? "info"
                                : "unknown",
                        msg: violation.Message ? violation.Message[0] : "NGL: No message"
                    };
                    files[fileNm].errors.push(err);
                    errId++;
                }
            }
        }
        result.files = files;
        this.lintResult = result;
        fse.removeSync(this.tmpXmlFileName); // Remove temporary file
    }

    // Reformat output if requested in command line
    async processNglOutput() {
        // Display as console log
        if (this.options.output === "txt") {
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
                        err.line.padEnd(4, " ") +
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
            this.nglOutputString += "\nnpm-groovy-lint results in " + c.bold(this.lintResult.summary.totalFilesLinted) + " linted files:\n";

            // Summary table
            const errorTableLine = {
                Severity: "Error",
                "Total found": this.lintResult.summary.totalErrorNumber,
                "Total fixed": this.lintResult.summary.totalFixedErrorNumber,
                "Total remaining": this.lintResult.summary.totalErrorNumber - this.lintResult.summary.totalFixedErrorNumber
            };
            const warningTableLine = {
                Severity: "Warning",
                "Total found": this.lintResult.summary.totalWarningNumber,
                "Total fixed": this.lintResult.summary.totalFixedWarningNumber,
                "Total remaining": this.lintResult.summary.totalWarningNumber - this.lintResult.summary.totalFixedWarningNumber
            };
            const infoTableLine = {
                Severity: "Info",
                "Total found": this.lintResult.summary.totalInfoNumber,
                "Total fixed": this.lintResult.summary.totalFixedInfoNumber,
                "Total remaining": this.lintResult.summary.totalInfoNumber - this.lintResult.summary.totalFixedInfoNumber
            };
            const summaryTable = [errorTableLine, warningTableLine, infoTableLine];

            // Output log
            console.log(this.nglOutputString);
            console.table(summaryTable, this.fixer ? ["Severity", "Total found", "Total fixed", "Total remaining"] : ["Severity", "Total found"]);
        }
        // Display as json
        else if (this.options.output === "json") {
            this.nglOutputString = JSON.stringify(this.lintResult);
            console.log(this.nglOutputString);
        }
    }
}

module.exports = NpmGroovyLint;
