#! /usr/bin/env node

// Imports
const c = require("ansi-colors");
const fse = require("fs-extra");
const os = require("os");
const cliProgress = require("cli-progress");
const util = require("util");
const xml2js = require("xml2js");
const NpmGroovyLintFix = require("./groovy-lint-fix.js");

class NpmGroovyLint {
    "use strict";

    options = {}; // NpmGroovyLint options
    args = []; // Command line arguments

    // Config
    jdeployFile;
    jdeployRootPath;
    tmpXmlFileName;

    // Codenarc
    codenarcArgs;
    codeNarcBaseDir;
    codeNarcStdOut;
    codeNarcStdErr;

    // npm-groovy-lint
    nglFix = false;
    lintResult = {};
    nglOutput;
    nglOutputString = "";
    status = 0;
    fixer;

    bar;
    barTimer;
    verbose = false;

    // Construction: initialize options & args
    constructor(optionsIn, argsIn) {
        this.options = optionsIn;
        if (argsIn) {
            this.args = argsIn;
        }
        this.verbose = this.options.verbose || this.findArg(this.args, "--ngl-verbose") || false;
        this.jdeployFile = this.options.jdeployFile || process.env.JDEPLOY_FILE || "originaljdeploy.js";
        this.jdeployRootPath = this.options.jdeployRootPath || process.env.JDEPLOY_ROOT_PATH || __dirname;
        this.tmpXmlFileName = this.options.tmpXmlFileName || os.tmpdir() + "/CodeNarcReportXml_" + Math.random() + ".xml";
    }

    async run() {
        await this.preProcess();
        await this.callCodeNarc();
        await this.postProcess();
        return this;
    }

    // Actions before call to CodeNarc
    async preProcess() {
        this.codenarcArgs = this.args.slice(2);

        // Define codeNarcBaseDir for later use ( postProcess )
        const codeNarcBaseDirInit = this.findArg(this.codenarcArgs, "-basedir", { stripQuotes: true });
        if (codeNarcBaseDirInit) {
            this.codeNarcBaseDir = process.cwd() + "/" + codeNarcBaseDirInit;
        } else {
            this.codeNarcBaseDir = process.cwd();
        }

        // Manage files prettifying ( not working yet)
        if (this.findArg(this.codenarcArgs, "--ngl-format")) {
            //await prettifyFiles(); // NV: not implemented yet
        }

        // Manage --ngl-fix option
        if (this.findArg(this.codenarcArgs, "--ngl-fix")) {
            this.nglFix = true;
            this.codenarcArgs.push("--ngl-output:text");
        }

        // Check if npm-groovy-lint reformatted output has been requested
        this.nglOutput = this.findArg(this.codenarcArgs, "--ngl-output");
        // Remove -report userArg if existing, and add XML type to generate temp xml file that will be parsed later
        if (this.nglOutput !== false) {
            this.codenarcArgs = this.codenarcArgs.filter(userArg => !userArg.includes("-report"));
            this.codenarcArgs.push("-report=xml:" + this.tmpXmlFileName);
        }
    }

    // Call CodeNard java class from renamed jdeploy.js
    async callCodeNarc() {
        // Build jdeploy codenarc command , filter non-codenarc arguments
        this.codenarcArgs = this.codenarcArgs.filter(userArg => !userArg.includes("-ngl-"));
        const jDeployCommand = '"' + this.args[0] + '" "' + this.jdeployRootPath.trim() + "/" + this.jdeployFile + '" ' + this.codenarcArgs.join(" ");

        // Start progress bar
        this.bar = new cliProgress.SingleBar(
            {
                format: "[{bar}] Running CodeNarc with arguments " + this.codenarcArgs.join(" "),
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
        }, 1000);

        // originalJDeploy.js Execution using child process
        const exec = util.promisify(require("child_process").exec);
        const { stdout, stderr } = await exec(jDeployCommand);

        // Stop progress bar
        clearInterval(this.barTimer);
        this.bar.stop();

        this.codeNarcStdOut = stdout;
        this.codeNarcStdErr = stderr;
    }

    // After CodeNarc call
    async postProcess() {
        // CodeNarc error
        if (this.codeNarcStdErr && this.codeNarcStdErr !== "Picked up _JAVA_OPTIONS: -Xmx512M\n") {
            this.status = 1;
            console.error("NGL: Error running CodeNarc: \n" + this.codeNarcStdErr);
        }
        // no --ngl* options
        else if (this.nglOutput === false) {
            console.log("NGL: Successfully processed CodeNarc: \n" + this.codeNarcStdOut);
        }
        // process --ngl* options
        else {
            // Parse XML result as js object
            await this.parseCodeNarcResult();
            // Fix when possible
            if (this.nglFix) {
                this.fixer = new NpmGroovyLintFix(this.lintResult, { verbose: this.verbose });
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
        if (this.nglOutput === "text" || this.nglOutput === true) {
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
                        default:
                            color = "magenta"; // should not happen
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
            console.table(summaryTable, ["Severity", "Total found", "Total fixed", "Total remaining"]);
        }
        // Display as json
        else if (this.nglOutput === "json") {
            this.nglOutputString = JSON.stringify(this.lintResult);
            console.log(this.nglOutputString);
        }
    }

    // Find argument (and associated value) in user args
    findArg(args, name, options = {}) {
        const argsRes = args.filter(userArg => userArg.includes(name));
        if (argsRes.length > 0) {
            if (argsRes[0].includes("=")) {
                let value = argsRes[0].split("=")[1];
                if (options.stripQuotes) {
                    value = value.replace(/^"(.*)"$/, "$1");
                    value = value.replace(/^'(.*)'$/, "$1");
                }
                return value;
            } else {
                return true;
            }
        }
        return false;
    }
}

module.exports = NpmGroovyLint;
