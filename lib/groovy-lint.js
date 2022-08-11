// Imports
const debug = require("debug")("npm-groovy-lint");
const os = require("os");
const performance = require("perf_hooks").performance;

const NpmGroovyLintFix = require("./groovy-lint-fix");
const CodeNarcCaller = require("./codenarc-caller");
const { prepareCodeNarcCall, parseCodeNarcResult, manageDeleteTmpFiles } = require("./codenarc-factory");
const { NPM_GROOVY_LINT_CONSTANTS, loadConfig, getConfigFileName } = require("./config.js");
const optionsDefinition = require("./options");
const { computeStats, processOutput } = require("./output.js");
const { recordAnonymousEvent } = require("./analytics.js");
const { getNpmGroovyLintVersion, getSourceLines, isErrorInLogLevelScope } = require("./utils");

class NpmGroovyLint {
    "use strict";

    options = {}; // NpmGroovyLint options
    args = []; // Command line arguments

    // Internal
    origin = "initialCall";
    requestKey;
    parseOptions;
    tmpGroovyFileName;

    // Codenarc / CodeNarcServer
    codenarcArgs = [];
    codeNarcBaseDir;
    codeNarcIncludes;
    codeNarcExcludes;
    codeNarcStdOut;
    codeNarcStdErr;
    codeNarcJsonResult;
    fileList;
    inputFileList;
    parseErrors = [];

    // npm-groovy-lint
    serverStatus = "unknown";
    outputType;
    output;
    onlyCodeNarc = false;
    lintResult = {};
    outputString = "";
    status = 0; // 0 if ok, 1 if expected error, 2 if unexpected error, 9 if cancelled request
    error; //
    fixer;
    startElapse;

    // Construction: initialize options & args
    constructor(argsIn, internalOpts = { parseOptions: true }) {
        if (argsIn) {
            this.args = argsIn;
        }
        this.parseOptions = internalOpts.parseOptions !== false;
        this.origin = internalOpts.origin || this.origin;
        this.requestKey = internalOpts.requestKey;
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
        // Create and run fixer
        debug(`Fix errors for ${JSON.stringify(errorIds)} on existing NpmGroovyLint instance`);
        await this.preProcess();
        this.fixer = new NpmGroovyLintFix(
            this.lintResult,
            {
                verbose: optns.verbose || this.options.verbose,
                fixrules: optns.fixrules || this.options.fixrules,
                source: optns.source || this.options.source,
                save: this.tmpGroovyFileName ? false : true
            },
            { origin: "externalCallToFix" }
        );
        await this.fixer.run({ errorIds: errorIds, propagate: true });
        this.lintResult = this.fixer.updatedLintResult;
        // Lint again after fix if requested (for the moment we prefer to trigger that from VsCode, for better UX)
        if (optns.nolintafter !== true) {
            // Control fix result by calling a new lint
            await this.lintAgainAfterFix();
        }
        // Compute stats & build output result
        this.lintResult = computeStats(this.lintResult);
        this.outputString = await processOutput(this.outputType, this.output, this.lintResult, this.options, this.fixer);
        // Delete Tmp file if existing
        manageDeleteTmpFiles(this.tmpGroovyFileName);
    }

    // Returns the full path of the configuration file
    async getConfigFilePath(path) {
        return await getConfigFileName(path || this.options.path || this.options.config, this.options.sourcefilepath);
    }

    // Returns the loaded config
    async loadConfig(configFilePath, mode = "lint") {
        return await loadConfig(configFilePath, mode, null, []);
    }

    //////////////////////////////////////////////////////////////////////
    // Below this point, methods should be called only by NpmGroovyLint //
    //////////////////////////////////////////////////////////////////////

    // Actions before call to CodeNarc
    async preProcess() {
        // Manage when the user wants to use only codenarc args
        if (Array.isArray(this.args) && this.args.includes("--codenarcargs")) {
            this.codenarcArgs = this.args.slice(2).filter(userArg => userArg !== "--codenarcargs");
            this.onlyCodeNarc = true;
            return true;
        }

        // Parse options (or force them if coming from lint re-run after fix)
        // Mix between command-line options and .groovyLint file options (priority is given to .groovyLint file)
        if (this.parseOptions) {
            try {
                this.options = optionsDefinition.parse(this.args);
                const configProperties = await loadConfig(
                    this.options.config || this.options.path,
                    this.options.format ? "format" : "lint",
                    this.options.sourcefilepath || this.options.path
                );
                for (const configProp of Object.keys(configProperties)) {
                    if (this.options[configProp] == null) {
                        this.options[configProp] = configProperties[configProp];
                    }
                }
            } catch (err) {
                this.status = 2;
                this.error = {
                    msg: `Parse options error: ${err.message}`,
                    stack: err.stack
                };
                console.error(this.error.msg);
                return false;
            }
            // Check options consistency: failon & loglevel
            if (this.options.failon && this.options.loglevel) {
                if (!isErrorInLogLevelScope(this.options.failon, this.options.loglevel)) {
                    this.status = 2;
                    this.error = {
                        msg: `failon option (${this.options.failon}) must be > loglevel option (${this.options.loglevel})`
                    };
                    console.error(this.error.msg);
                    return false;
                }
            }
        } else {
            this.options = this.args;
        }

        // Manage anonymous stats
        if (["initialCall", "index"].includes(this.origin) && this.options.insight === true) {
            this.startElapse = performance.now();
        }

        // Kill running CodeNarcServer
        if (this.options.killserver) {
            const startPerf = performance.now();
            const codeNarcCaller = new CodeNarcCaller(this.codenarcArgs, this.serverStatus, this.args, this.options, {
                groovyFileName: this.tmpGroovyFileName
            });
            this.outputString = await codeNarcCaller.killCodeNarcServer();
            console.info(this.outputString);
            this.manageStats(startPerf);
            return false;
        }

        // Show version
        if (this.options.version) {
            const v = getNpmGroovyLintVersion();

            const codeNarcVersionLinter = await new NpmGroovyLint([process.execPath, "", "--codenarcargs", "-version"], {}).run();
            const codeNarcVersionLines = [(await getSourceLines(codeNarcVersionLinter.codeNarcStdOut))[0]];

            const versions = [];
            versions.push(`npm-groovy-lint version ${v}`);
            versions.push("");
            versions.push("Embeds:");
            versions.push(...codeNarcVersionLines);
            versions.push(`- Groovy version ${NPM_GROOVY_LINT_CONSTANTS["GroovyVersion"]} (superlite)`);
            const versionsOut = versions.join(os.EOL);
            console.info(versionsOut);
            this.outputString = versionsOut;
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

        // Prepare CodeNarc call then set result on NpmGroovyLint instance
        const codeNarcFactoryResult = await prepareCodeNarcCall(this.options);
        this.setMethodResult(codeNarcFactoryResult);

        return this.error == null ? true : false;
    }

    /* Order of attempts (supposed to work on every config):
        - Call CodeNarcServer via Http (except if --noserver)
        - Launch CodeNarcServer using com.nvuillam.CodeNarcServer, then call CodeNarcServer via Http (except if --noserver)
        - Call CodeNarc java using com.nvuillam.CodeNarcServer (without launching server)
        - Call CodeNarc java using org.codenarc.CodeNarc 
    */
    async callCodeNarc() {
        const startPerf = performance.now();
        let serverCallResult = { status: null };
        const codeNarcCaller = new CodeNarcCaller(this.codenarcArgs, this.serverStatus, this.args, this.options, {
            groovyFileName: this.tmpGroovyFileName ? this.tmpGroovyFileName : null,
            requestKey: this.requestKey || null,
            codeNarcBaseDir: this.codeNarcBaseDir,
            codeNarcIncludes: this.codeNarcIncludes,
            codeNarcExcludes: this.codeNarcExcludes,
            onlyCodeNarc: this.onlyCodeNarc,
            inputFileList: this.inputFileList
        });
        if (!this.options.noserver) {
            serverCallResult = await codeNarcCaller.callCodeNarcServer();
        }
        if ([1, 2, null].includes(serverCallResult.status)) {
            serverCallResult = await codeNarcCaller.callCodeNarcJava();
        }
        this.setMethodResult(serverCallResult);
        this.manageStats(startPerf);
    }

    // After CodeNarc call
    async postProcess() {
        // Cancelled request
        if (this.status === 9) {
            console.info(`GroovyLint: Request cancelled by duplicate call on requestKey ${this.requestKey}`);
        }
        // CodeNarc error
        else if ((this.codeNarcStdErr && [null, "", undefined].includes(this.codeNarcStdOut)) || this.status > 0) {
            this.status = 2;
            console.error("GroovyLint: Error running CodeNarc: \n" + this.codeNarcStdErr);
        }
        // only --codenarcargs arguments
        else if (this.onlyCodeNarc) {
            console.log("GroovyLint: Successfully processed CodeNarc: \n" + this.codeNarcStdOut);
        }
        // process npm-groovy-lint options ( output, fix, formatting ...)
        else {
            // Parse XML result as js object
            this.lintResult = await parseCodeNarcResult(
                this.options,
                this.codeNarcBaseDir,
                this.codeNarcJsonResult,
                this.tmpGroovyFileName,
                this.parseErrors
            );
            // Fix all found errors if requested
            if (this.options.fix || this.options.format) {
                this.fixer = new NpmGroovyLintFix(this.lintResult, {
                    format: this.options.format === true,
                    fixrules: this.options.fixrules,
                    source: this.options.source,
                    save: this.tmpGroovyFileName ? false : true,
                    origin: this.origin,
                    rules: this.options.rules,
                    verbose: this.options.verbose
                });
                await this.fixer.run();
                this.lintResult = this.fixer.updatedLintResult;
                // Post actions
                const checkIfFixAgainRequiredRes = this.checkIfFixAgainRequired();
                if (checkIfFixAgainRequiredRes.runAgain === true && this.origin !== "fixAgainAfterFix") {
                    await this.fixAgainAfterFix(checkIfFixAgainRequiredRes.files);
                }
                // If there has been fixes, call CodeNarc again to get updated error list
                if (this.fixer.fixedErrorsNumber > 0 && this.options.nolintafter !== true && this.origin !== "fixAgainAfterFix") {
                    await this.lintAgainAfterFix();
                }
            }
            // Output result
            this.lintResult = computeStats(this.lintResult);
            this.outputString = await processOutput(this.outputType, this.output, this.lintResult, this.options, this.fixer);
        }

        // Manage anonymous usage stats (except if current lint has been cancelled by a duplicate call)
        if (this.startElapse && this.options.insight === true && this.status !== 9) {
            const elapsedTimeMs = parseInt(performance.now() - this.startElapse);
            const callerKey = this.origin === "index" ? "cli" : "module";
            const actionKey = this.options.format ? "format" : this.options.fix ? "fix" : "lint";
            const data = {
                status: this.status,
                fileList: this.fileList,
                result: this.lintResult,
                elapsed: elapsedTimeMs,
                options: this.options,
                error: this.error
            };
            const eventSentPromise = recordAnonymousEvent(callerKey + "-" + actionKey, data);
            if (callerKey === "cli") {
                await eventSentPromise;
            }
        }

        manageDeleteTmpFiles(this.tmpGroovyFileName);

        // Manage return code in case failonerror, failonwarning or failoninfo is called
        this.manageReturnCode();
    }

    // Check if fixed errors required a new lint & fix
    checkIfFixAgainRequired() {
        let runAgain = false;
        const runAgainOnFiles = {};
        for (const file of Object.keys(this.lintResult.files)) {
            for (const err of this.lintResult.files[file].errors) {
                if (err.fixed === true && err.triggersAgainAfterFix && err.triggersAgainAfterFix.length > 0) {
                    runAgain = true;
                    runAgainOnFiles[file] = runAgainOnFiles[file] ? runAgainOnFiles[file] : { fixrules: [] };
                    runAgainOnFiles[file].fixrules.push(...err.triggersAgainAfterFix);
                }
            }
        }
        return { runAgain: runAgain, files: runAgainOnFiles };
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
        debug(`Fix is done, lint again with options ${JSON.stringify(lintAgainOptions)}`);
        const newLinter = new NpmGroovyLint(lintAgainOptions, {
            parseOptions: false,
            origin: "lintAgainAfterFix"
        });
        // Run linter
        await newLinter.run();
        // Merge new linter results in existing results
        this.lintResult = this.mergeResults(this.lintResult, newLinter.lintResult);
    }

    // Fix again after fix because fixed rules contained triggersAgainAfterFix property (for the moment, only Indentation rule)
    async fixAgainAfterFix(filesAndRulesToProcess) {
        const fixAgainOptions = JSON.parse(JSON.stringify(this.options));
        // Gather rules to lint & fix again
        let fixRules = [];
        for (const file of Object.keys(filesAndRulesToProcess)) {
            fixRules.push(...filesAndRulesToProcess[file].fixrules);
        }
        fixRules = [...new Set(fixRules)]; // Remove duplicates
        if (this.options.source) {
            fixAgainOptions.source = this.lintResult.files[0].updatedSource;
        }
        // Lint & fix again only the requested rules for better performances
        delete fixAgainOptions.format;
        delete fixAgainOptions.rules;
        delete fixAgainOptions.overriddenRules;
        fixAgainOptions.rulesets = Object.keys(this.options.rules)
            .filter(ruleName => fixRules.includes(ruleName))
            .map(ruleName => `${ruleName}${JSON.stringify(this.options.rules[ruleName])}`)
            .join(",");
        fixAgainOptions.fix = true;
        fixAgainOptions.fixrules = fixRules.join(",");
        fixAgainOptions.output = "none";
        // Process lint & fix
        debug(`Fix triggered rule requiring another lint & fix, do it again with options ${JSON.stringify(fixAgainOptions)}`);
        const newLinter = new NpmGroovyLint(fixAgainOptions, { origin: "fixAgainAfterFix" });
        await newLinter.run();

        // Merge new linter & fixer results in existing results
        this.lintResult = this.mergeFixAgainResults(this.lintResult, newLinter.lintResult);
    }

    // Merge results after control lint after fixing
    mergeResults(lintResAfterFix, lintResControl) {
        const mergedLintResults = { files: {} };
        for (const afterFixResFileNm of Object.keys(lintResAfterFix.files)) {
            // Append fixed errors to errors found via control lint (post fix)
            const afterFixFileErrors = lintResAfterFix.files[afterFixResFileNm].errors;
            const fixedErrors = afterFixFileErrors.filter(err => err.fixed === true);
            const controlFileErrors =
                lintResControl.files && lintResControl.files[afterFixResFileNm] ? lintResControl.files[afterFixResFileNm].errors || [] : [];
            const mergedFileErrors = controlFileErrors.concat(fixedErrors);
            mergedLintResults.files[afterFixResFileNm] = { errors: mergedFileErrors };
            // Set updatedSource in results in provided
            if (lintResAfterFix.files[afterFixResFileNm].updatedSource) {
                mergedLintResults.files[afterFixResFileNm].updatedSource = lintResAfterFix.files[afterFixResFileNm].updatedSource;
            }
        }
        return mergedLintResults;
    }

    // Merge results after second fix performed (only get updated source)
    mergeFixAgainResults(lintResToUpdate, lintResAfterNewFix) {
        if (lintResToUpdate.files && lintResToUpdate.files[0]) {
            if (Object.keys(lintResAfterNewFix.files).length > 0) {
                const key = Object.keys(lintResAfterNewFix.files)[0];
                const updtSource = lintResAfterNewFix.files[key].updatedSource;
                if (updtSource) {
                    lintResToUpdate.files[0] = Object.assign(lintResToUpdate.files[0], { updatedSource: updtSource });
                }
            }
        } else if (lintResAfterNewFix && lintResAfterNewFix.files) {
            for (const afterNewFixResFileNm of Object.keys(lintResAfterNewFix.files)) {
                // Set updatedSource in results in provided
                if (lintResAfterNewFix.files[afterNewFixResFileNm].updatedSource) {
                    lintResToUpdate.files[afterNewFixResFileNm].updatedSource = lintResAfterNewFix.files[afterNewFixResFileNm].updatedSource;
                }
            }
        }
        return lintResToUpdate;
    }

    // Set lib results on this NpmGroovyLint instance
    setMethodResult(libResult) {
        for (const propName of Object.keys(libResult)) {
            this[propName] = libResult[propName];
        }
    }

    // Increment stats for test classes in necessary
    manageStats(startPerf) {
        if (globalThis && globalThis.codeNarcCallsCounter >= 0) {
            globalThis.codeNarcCallsCounter++;
            const optionsLog = JSON.parse(JSON.stringify(this.options));
            for (const prop of ["source", "rules", "verbose", "loglevel", "serverhost", "serverport", "_"]) {
                delete optionsLog[prop];
            }
            globalThis.codeNarcCalls.push({
                origin: this.origin,
                elapse: parseInt(performance.now() - startPerf),
                options: optionsLog,
                args: this.codenarcArgs
            });
        }
    }

    // Exit with code 1 if failon, failonerror, failonwarning or failoninfo is set
    manageReturnCode() {
        const failureLevel =
            this.options.failon && this.options.failon !== "none"
                ? this.options.failon
                : this.options.failonerror
                ? "error"
                : this.options.failonwarning
                ? "warning"
                : this.options.failoninfo
                ? "info"
                : "none";
        if (failureLevel === "none") {
            return;
        }

        const errorNb = this.lintResult.summary.totalFoundErrorNumber;
        const warningNb = this.lintResult.summary.totalFoundWarningNumber;
        const infoNb = this.lintResult.summary.totalFoundInfoNumber;

        // Fail on error
        if (failureLevel === "error" && errorNb > 0) {
            console.error(`Failure: ${this.lintResult.summary.totalFoundErrorNumber} error(s) have been found`);
            this.status = 1;
        }
        // Fail on warning
        else if (failureLevel === "warning" && (errorNb > 0 || warningNb > 0)) {
            console.error(
                `Failure: ${this.lintResult.summary.totalFoundErrorNumber} error(s) have been found \n ${this.lintResult.summary.totalFoundWarningNumber} warning(s) have been found`
            );
            this.status = 1;
        }
        // Fail on info
        else if (failureLevel === "info" && (errorNb > 0 || warningNb > 0 || infoNb > 0)) {
            console.error(
                `Failure: ${this.lintResult.summary.totalFoundErrorNumber} error(s) have been found \n ${this.lintResult.summary.totalFoundWarningNumber} warning(s) have been found \n ${this.lintResult.summary.totalFoundInfoNumber} info(s) have been found`
            );
            this.status = 1;
        }
    }
}

module.exports = NpmGroovyLint;
