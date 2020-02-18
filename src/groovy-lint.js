// Imports
const util = require("util");
const fse = require("fs-extra");
const os = require("os");
const xml2js = require("xml2js");

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
    codeNarcStdOut;
    codeNarcStdErr;
    codeNarcResult;

    // npm-groovy-lint
    nglOutput;
    nglOutputString;
    status = 0;

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

        // Manage files prettifying ( not working yet)
        if (this.findArg(this.codenarcArgs, "--ngl-format")) {
            this.codenarcArgs = this.removeArg(this.codenarcArgs, "--ngl-format");
            //await prettifyFiles(); // NV: not implemented yet
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

    async postProcess() {
        if (this.codeNarcStdErr && this.codeNarcStdErr !== "Picked up _JAVA_OPTIONS: -Xmx512M\n") {
            this.status = 1;
            console.error("NGL: Error running CodeNarc: \n" + this.codeNarcStdErr);
        } else if (this.nglOutput === false) {
            console.log("NGL: Successfully processed CodeNarc: \n" + this.codeNarcStdOut);
        } else {
            await this.parseCodeNarcResult();
            await this.processNglOutput();
        }
    }

    async parseCodeNarcResult() {
        const parser = new xml2js.Parser();
        const tempXmlFileContent = await parser.parseStringPromise(fse.readFileSync(this.tmpXmlFileName), {});
        if (!tempXmlFileContent || !tempXmlFileContent.CodeNarc || !tempXmlFileContent.CodeNarc.Package) {
            console.log(tempXmlFileContent.CodeNarc.Package[0]);
            throw new Error("Unable to parse temporary codenarc xml report file " + this.tmpXmlFileName);
        }
        const result = {};
        const files = {};
        for (const folderInfo of tempXmlFileContent.CodeNarc.Package) {
            if (!folderInfo.File) {
                continue;
            }
            for (const fileInfo of folderInfo.File) {
                const fileNm = folderInfo["$"].path + "/" + fileInfo["$"].name;
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
            for (const fileNm of Object.keys(this.codeNarcResult.files)) {
                const fileErrors = this.codeNarcResult.files[fileNm].errors;
                this.nglOutputString += "File: " + fileNm + "\n";
                for (const err of fileErrors) {
                    this.nglOutputString +=
                        "  " + err.line.padEnd(4, " ") + "  " + err.severity.padEnd(7, " ") + "  " + err.rule.padEnd(24, " ") + "  " + err.msg + "\n";
                }
                this.nglOutputString += "\n";
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
    findArg(args, name) {
        const argsRes = args.filter(userArg => userArg.includes(name));
        if (argsRes.length > 0) {
            if (argsRes[0].includes("=")) {
                return argsRes[0].split("=")[1];
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
