#! /usr/bin/env node

// Imports
const util = require("util");
const fse = require("fs-extra");
const os = require("os");
const xml2js = require("xml2js");
const c = require("ansi-colors");
const NpmGroovyLintFix = require("./groovy-lint-fix.js");

class NpmGroovyLint {
    "use strict";

    options = {}; // NpmGroovyLint options
    args = null; // Command line arguments

    // Config
    jdeployFile;
    jdeployRootPath;
    tmpXmlFileName;

    // Codenarc
    codenarcArgs;
    codeNarcBaseDir;
    codeNarcStdOut;
    codeNarcStdErr;
    codeNarcResult;

    // npm-groovy-lint
    nglFix = false;
    nglOutput;
    nglOutputString = "";
    status = 0;
    fixer;

    // Construction: initialize options & args
    constructor(optionsIn, argsIn) {
        this.options = optionsIn;
        if (argsIn) {
            this.args = argsIn;
        }
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
            this.codenarcArgs = this.removeArg(this.codenarcArgs, "--ngl-format");
            //await prettifyFiles(); // NV: not implemented yet
        }

        // Manage --ngl-fix option
        if (this.findArg(this.codenarcArgs, "--ngl-fix")) {
            this.nglFix = true;
            this.codenarcArgs = this.removeArg(this.codenarcArgs, "--ngl-fix");
            this.codenarcArgs.push("--ngl-output:text");
        }

        // Check if npm-groovy-lint reformatted output has been requested
        this.nglOutput = this.findArg(this.codenarcArgs, "--ngl-output");
        // Remove -report userArg if existing, and add XML type to generate temp xml file that will be parsed later
        if (this.nglOutput !== false) {
            this.codenarcArgs = this.removeArg(this.codenarcArgs, "-report");
            this.codenarcArgs = this.removeArg(this.codenarcArgs, "--ngl-output");
            this.codenarcArgs.push("-report=xml:" + this.tmpXmlFileName);
        }
    }

    // Call CodeNard java class from renamed jdeploy.js
    async callCodeNarc() {
        // Build command
        const jDeployCommand = '"' + this.args[0] + '" "' + this.jdeployRootPath.trim() + "/" + this.jdeployFile + '" ' + this.codenarcArgs.join(" ");
        //console.debug(jDeployCommand);

        // Run jdeploy as child process
        console.info("NGL: Running CodeNarc with arguments " + this.codenarcArgs.join(" "));
        const exec = util.promisify(require("child_process").exec);
        const { stdout, stderr } = await exec(jDeployCommand);
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
                this.fixer = new NpmGroovyLintFix(this.codeNarcResult, { debug: true });
                await this.fixer.run();
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
        const result = {};
        const files = {};
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
                        line: violation["$"].lineNumber,
                        rule: violation["$"].ruleName,
                        severity:
                            violation["$"].priority == "1"
                                ? "error"
                                : violation["$"].priority == "2"
                                ? "warning"
                                : violation["$"].priority == "3"
                                ? "warning"
                                : "unknown",
                        msg: violation.Message ? violation.Message[0] : "NGL: No message"
                    };
                    files[fileNm].errors.push(err);
                }
            }
        }
        result.files = files;
        this.codeNarcResult = result;
        fse.removeSync(this.tmpXmlFileName); // Remove temporary file
    }

    // Reformat output if requested in command line
    async processNglOutput() {
        // Display as console log
        if (this.nglOutput === "text" || this.nglOutput === true) {
            // Errors
            for (const fileNm of Object.keys(this.codeNarcResult.files)) {
                const fileErrors = this.codeNarcResult.files[fileNm].errors;
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
                        default:
                            color = "magenta"; // should not happen
                    }
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
            // Fixes result
            if (this.fixer) {
                this.nglOutputString += "\n\nnpm-groovy-lint fixed " + c.bold(this.fixer.fixedErrorsNumber) + " errors";
            }

            console.log(this.nglOutputString);
        }
        // Display as json
        else if (this.nglOutput === "json") {
            this.nglOutputString = JSON.stringify(this.codeNarcResult);
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
            } else return true;
        }
        return false;
    }

    // Remove argument from user args
    removeArg(args, name) {
        return args.filter(userArg => !userArg.includes(name));
    }
}

module.exports = NpmGroovyLint;
