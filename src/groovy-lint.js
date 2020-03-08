#! /usr/bin/env node

const DEFAULT_VERSION = "3.0.0-beta.2";

// Imports
const cliProgress = require("cli-progress");
const debug = require("debug")("npm-groovy-lint");
const { performance } = require("perf_hooks");
const request = require("request");
const rp = require("request-promise-native");
const util = require("util");

const exec = util.promisify(require("child_process").exec);
const NpmGroovyLintFix = require("./groovy-lint-fix");
const { prepareCodeNarcCall, parseCodeNarcResult, manageDeleteTmpFiles } = require("./codenarc-factory.js");
const optionsDefinition = require("./options");
const { processOutput } = require("./output.js");

class NpmGroovyLint {
    "use strict";

    options = {}; // NpmGroovyLint options
    args = []; // Command line arguments

    // Internal
    jdeployFile;
    jdeployFilePlanB;
    jdeployRootPath;
    parseOptions;
    tmpXmlFileName;
    tmpGroovyFileName;
    tmpRuleSetFileName;

    // Codenarc
    codenarcArgs = [];
    codeNarcBaseDir;
    codeNarcStdOut;
    codeNarcStdErr;

    // npm-groovy-lint
    serverStatus = "unknown";
    outputType;
    output;
    onlyCodeNarc = false;
    lintResult = {};
    outputString = "";
    status = 0;
    fixer;
    execTimeout = 240000;

    bar;
    barTimer;

    // Construction: initialize options & args
    constructor(argsIn, internalOpts = { parseOptions: true }) {
        if (argsIn) {
            this.args = argsIn;
        }
        this.jdeployFile = internalOpts.jdeployFile || process.env.JDEPLOY_FILE || "originaljdeploy.js";
        this.jdeployFilePlanB = internalOpts.jdeployFilePlanB || process.env.JDEPLOY_FILE_PLAN_B || "originaljdeployPlanB.js";
        this.jdeployRootPath = internalOpts.jdeployRootPath || process.env.JDEPLOY_ROOT_PATH || __dirname;
        this.parseOptions = internalOpts.parseOptions !== false;
    }

    // Run linting (and fixing if --fix)
    async run() {
        debug(`<<< NpmGroovyLint.run START >>>`);
        const doProcess = await this.preProcess();
        if (doProcess) {
            await this.callCodeNarc();
            await this.postProcess();
        }
        debug(`>>> NpmGroovyLint.run END <<<`);
        return this;
    }

    // Call an existing NpmGroovyLint instance to request fix of errors
    async fixErrors(errorIds, optns = {}) {
        debug(`Fix errors for ${JSON.stringify(errorIds)} on existing NpmGroovyLint instance`);
        this.fixer = new NpmGroovyLintFix(this.lintResult, {
            verbose: optns.verbose || this.options.verbose,
            fixrules: optns.fixrules || this.options.fixrules,
            source: optns.source || this.options.source,
            save: this.tmpGroovyFileName ? false : true
        });
        await this.fixer.run({ errorIds: errorIds, propagate: true });
        this.lintResult = this.fixer.updatedLintResult;
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
            let v = process.env.npm_package_version;
            if (!v) {
                try {
                    v = require("package.json").version;
                } catch {
                    v = DEFAULT_VERSION;
                }
            }
            const vLabel = "npm-groovy-lint v" + v;
            console.info(vLabel);
            this.outputString = vLabel;
            return false;
        }

        // Show help ( index or for an options)
        if (this.options.help) {
            if (this.options._.length) {
                this.outputString = optionsDefinition.generateHelpForOption(this.options._[0]);
            } else {
                this.outputString = optionsDefinition.generateHelp();
            }
            console.info(this.outputString);
            return false;
        }

        // Kill running CodeNarcServer
        if (this.options.killserver) {
            const serverUri = this.getCodeNarcServerUri() + "/kill";
            try {
                const parsedBody = await rp({
                    method: "POST",
                    uri: serverUri,
                    timeout: 5000,
                    json: true
                });
                if (parsedBody.status === "killed") {
                    this.outputString = "CodeNarcServer terminated";
                } else {
                    this.outputString = "Error killing CodeNarcServer";
                }
            } catch (e) {
                if (e.message.includes("socket hang up")) {
                    this.outputString = "CodeNarcServer terminated";
                } else {
                    this.outputString = "CodeNarcServer was not running";
                }
            }
            console.info(this.outputString);
            return false;
        }

        // Prepare CodeNarc call then set result on NpmGroovyLint instance
        const codeNarcFactoryResult = await prepareCodeNarcCall(this.options, this.jdeployRootPath);
        for (const propName of Object.keys(codeNarcFactoryResult)) {
            this[propName] = codeNarcFactoryResult[propName];
        }
        return true;
    }

    /* Order of attempts (supposed to work on every config):
        - Call CodeNarcServer via Http (except if --noserver)
        - Launch CodeNarcServer using com.nvuillam.CodeNarcServer, then call CodeNarcServer via Http (except if --noserver)
        - Call CodeNarc using com.nvuillam.CodeNarcServer (without launching server) (originaljdeploy.js)
        - Call CodeNarc using org.codenarc.CodeNarc (originaljdeployPlanB.js)
    */
    async callCodeNarc() {
        let serverSuccess = false;
        if (!this.options.noserver) {
            serverSuccess = await this.callCodeNarcServer();
        }
        if (!serverSuccess) {
            await this.callCodeNarcJava();
        }
    }

    // Call local CodeNarc server if running
    async callCodeNarcServer() {
        // If use of --codenarcargs, get default values for CodeNarcServer host & port
        const serverUri = this.getCodeNarcServerUri();
        // Remove "" around values because they won't get thru system command line parser
        const codeNarcArgsForServer = this.codenarcArgs.map(codeNarcArg => {
            if (codeNarcArg.includes('="') || codeNarcArg.includes(':"')) {
                codeNarcArg = codeNarcArg.replace('="', "=").replace(':"', ":");
                codeNarcArg = codeNarcArg.substring(0, codeNarcArg.length - 1);
            }
            return codeNarcArg;
        });
        // Call CodeNarc server
        const codeNarcArgsString = codeNarcArgsForServer.join(" ");
        const rqstOptions = {
            method: "POST",
            uri: serverUri,
            body: {
                codeNarcArgs: codeNarcArgsString
            },
            json: true
        };
        debug(`CALL CodeNarcServer with ${JSON.stringify(rqstOptions, null, 2)}`);
        let parsedBody = null;
        try {
            parsedBody = await rp(rqstOptions);
            this.serverStatus = "running";
        } catch (e) {
            // If server not started , start it and try again
            if (
                e.message &&
                e.message.includes("ECONNREFUSED") &&
                ["unknown", "running"].includes(this.serverStatus) &&
                (await this.startCodeNarcServer())
            ) {
                if (this.serverStatus === "running") {
                    return await this.callCodeNarcServer();
                }
            }
            this.serverStatus = "error";
            return false;
        }
        this.codeNarcStdOut = parsedBody.stdout;
        this.codeNarcStdErr = parsedBody.stderr;
        return parsedBody.status === "success";
    }

    // Call CodeNard java class from renamed jdeploy.js
    async callCodeNarcJava(secondAttempt = false) {
        // Build jdeploy codenarc command (request to launch server for next call except if --noserver is sent)
        const nodeExe = this.args[0] && this.args[0].includes("node") ? this.args[0] : "node";
        const jdeployFileToUse = secondAttempt ? this.jdeployFilePlanB : this.jdeployFile;
        const jDeployCommand = '"' + nodeExe + '" "' + this.jdeployRootPath.trim() + "/" + jdeployFileToUse + '" ' + this.codenarcArgs.join(" ");

        // Start progress bar
        debug(`CALL CodeNarcJava with ${jDeployCommand}`);
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

        // originalJDeploy.js Execution using child process (or originaljdeployPlanB if originaljdeploy.js failed)
        let execRes;
        try {
            execRes = await exec(jDeployCommand, { timeout: this.execTimeout });
        } catch (e) {
            clearInterval(this.barTimer);
            this.bar.stop();
            // If failure (missing class com.nvuillam.CodeNarcServer for example, it can happen on Linux, let's try the original org.codenarc.CodeNarc class)
            if (!secondAttempt) {
                return await this.callCodeNarcJava(true);
            } else {
                this.codeNarcStdErr = e.stderr;
                return;
            }
        }

        // Stop progress bar
        clearInterval(this.barTimer);
        this.bar.stop();

        this.codeNarcStdOut = execRes.stdout;
        this.codeNarcStdErr = execRes.stderr;
    }

    // Start CodeNarc server so it can be called via Http just after
    async startCodeNarcServer() {
        this.serverStatus = "unknown";
        const maxAttemptTimeMs = 10000;
        let attempts = 1;
        const nodeExe = this.args[0] && this.args[0].includes("node") ? this.args[0] : "node";
        const jDeployCommand = '"' + nodeExe + '" "' + this.jdeployRootPath.trim() + "/" + this.jdeployFile + '" --server';
        const serverPingUri = this.getCodeNarcServerUri() + "/ping";
        let interval;
        debug(`ATTEMPT to start CodeNarcServer with ${jDeployCommand}`);
        try {
            // Start server using java (we don't care the promise result, as the following promise will poll the server)
            let stop = false;
            let eJava;
            exec(jDeployCommand, { timeout: this.execTimeout })
                .then(() => {})
                .catch(eRun => {
                    stop = true;
                    eJava = eRun;
                });
            // Poll it until it is ready
            const start = performance.now();
            await new Promise(resolve => {
                interval = setInterval(() => {
                    // If java call crashed, don't bother polling
                    if (stop) {
                        this.declareServerError(eJava, interval);
                        resolve();
                    }
                    request
                        .get(serverPingUri)
                        .on("response", response => {
                            if (response.statusCode === 200) {
                                this.serverStatus = "running";
                                debug(`SUCCESS: CodeNarcServer is running`);
                                clearInterval(interval);
                                resolve();
                            } else if (this.serverStatus === "unknown" && performance.now() - start > maxAttemptTimeMs) {
                                this.declareServerError(
                                    {
                                        message: "Timeout after " + maxAttemptTimeMs + "\nResponse: " + JSON.stringify(response.toJSON())
                                    },
                                    interval
                                );
                                resolve();
                            }
                        })
                        .on("error", e => {
                            if (this.serverStatus === "unknown" && performance.now() - start > maxAttemptTimeMs) {
                                this.declareServerError(e, interval);
                                resolve();
                            }
                        });
                }, 1000);
            });
        } catch (e) {
            this.declareServerError(e, interval);
            return false;
        }
        if (this.serverStatus === "running") {
            console.log(`NGL: Started CodeNarc Server after ${attempts} attempts`);
            return true;
        } else {
            return false;
        }
    }

    // Stop polling and log error
    declareServerError(e, interval) {
        this.serverStatus = "error";
        if (interval) {
            clearInterval(interval);
        }
        const errMsg = "NGL: Unable to start CodeNarc Server. Use --noserver if you do not even want to try";
        debug(errMsg);
        debug(e.message);
        console.log(errMsg);
    }

    // Return CodeNarc server URI
    getCodeNarcServerUri() {
        // If use of --codenarcargs, get default values for CodeNarcServer host & port
        const serverOptions = optionsDefinition.parse({});
        return (this.options.serverhost || serverOptions.serverhost) + ":" + (this.options.serverport || serverOptions.serverport);
    }

    // After CodeNarc call
    async postProcess() {
        // CodeNarc error
        if (this.codeNarcStdErr && [null, "", undefined].includes(this.codeNarcStdOut)) {
            this.status = 1;
            console.error("NGL: Error running CodeNarc: \n" + this.codeNarcStdErr);
        }
        // only --codenarcargs arguments
        else if (this.onlyCodeNarc) {
            console.log("NGL: Successfully processed CodeNarc: \n" + this.codeNarcStdOut);
        }
        // process npm-groovy-lint options ( output, fix, formatting ...)
        else {
            // Parse XML result as js object
            this.lintResult = await parseCodeNarcResult(this.options, this.codeNarcBaseDir, this.tmpXmlFileName);
            // Fix all found errors if requested
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
            this.outputString = await processOutput(this.outputType, this.output, this.lintResult, this.options, this.fixer);
        }

        manageDeleteTmpFiles(this.tmpGroovyFileName, this.tmpRuleSetFileName);
    }

    // Lint again after fixes and merge in existing results
    async lintAgainAfterFix() {
        // same Options except fix = false & output = none
        const lintAgainOptions = JSON.parse(JSON.stringify(this.options));
        debug(`Fix is done, lint again with options ${JSON.stringify(lintAgainOptions)}`);
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

        // Pipes because variable content depends that if we run linter after fix or not
        // Reset properties and update counters
        updatedResults.files = {};
        updatedResults.summary.totalFoundErrorNumber = afterFixResults.summary.totalFoundErrorNumber;
        updatedResults.summary.totalFoundWarningNumber = afterFixResults.summary.totalFoundWarningNumber;
        updatedResults.summary.totalFoundInfoNumber = afterFixResults.summary.totalFoundInfoNumber;
        updatedResults.summary.totalFixedErrorNumber = initialResults.summary.totalFixedErrorNumber;
        updatedResults.summary.totalFixedWarningNumber = initialResults.summary.totalFixedWarningNumber;
        updatedResults.summary.totalFixedInfoNumber = initialResults.summary.totalFixedInfoNumber;

        // Remove not fixed errors from initial result and add remaining errors of afterfixResults
        let fixedErrorsNumber = 0;
        const fixedErrorsIds = [];
        for (const fileNm of Object.keys(initialResults.files)) {
            const initialResfileErrors = initialResults.files[fileNm].errors;
            const afterFixResfileErrors = afterFixResults.files[fileNm] ? afterFixResults.files[fileNm].errors : [];
            const fileDtl = {
                errors: afterFixResfileErrors,
                updatedSource: initialResults.files[fileNm].updatedSource
            };
            for (const initialFileError of initialResfileErrors) {
                if (initialFileError.fixed) {
                    fixedErrorsNumber++;
                    fixedErrorsIds.push(initialFileError.id);
                    fileDtl.errors.push(initialFileError);
                }
            }
            updatedResults.files[fileNm] = fileDtl;
        }
        updatedResults.summary.fixedErrorsNumber = fixedErrorsNumber;
        updatedResults.summary.fixedErrorsIds = fixedErrorsIds;
        debug(`Merged results summary ${JSON.stringify(updatedResults.summary)}`);
        return updatedResults;
    }
}

module.exports = NpmGroovyLint;
