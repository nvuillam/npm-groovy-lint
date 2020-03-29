#! /usr/bin/env node

const DEFAULT_VERSION = "3.0.0";

// Imports
const debug = require("debug")("npm-groovy-lint");

const NpmGroovyLintFix = require("./groovy-lint-fix");
const CodeNarcCaller = require("./codenarc-caller");
const { prepareCodeNarcCall, parseCodeNarcResult, manageDeleteTmpFiles } = require("./codenarc-factory");
const { loadConfig, getConfigFileName } = require("./config.js");
const optionsDefinition = require("./options");
const { computeStats, processOutput } = require("./output.js");

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
        // Create and run fixer
        debug(`Fix errors for ${JSON.stringify(errorIds)} on existing NpmGroovyLint instance`);
        const codeNarcFactoryResult = await prepareCodeNarcCall(this.options, this.jdeployRootPath);
        this.setMethodResult(codeNarcFactoryResult);
        this.fixer = new NpmGroovyLintFix(this.lintResult, {
            verbose: optns.verbose || this.options.verbose,
            fixrules: optns.fixrules || this.options.fixrules,
            source: optns.source || this.options.source,
            save: this.tmpGroovyFileName ? false : true
        });
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
        manageDeleteTmpFiles(this.tmpGroovyFileName, this.tmpRuleSetFileName);
    }

    // Returns the full path of the configuration file
    async getConfigFilePath(path) {
        return await getConfigFileName(path || this.options.path || this.options.config, this.options.sourcefilepath);
    }

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
                    this.options.sourcefilepath
                );
                for (const configProp of Object.keys(configProperties)) {
                    if (this.options[configProp] == null) {
                        this.options[configProp] = configProperties[configProp];
                    }
                }
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
            const codeNarcCaller = new CodeNarcCaller(this.codenarcArgs, this.serverStatus, this.args, this.options, {
                jdeployFile: this.jdeployFile,
                jdeployFilePlanB: this.jdeployFilePlanB,
                jdeployRootPath: this.jdeployRootPath
            });
            this.outputString = await codeNarcCaller.killCodeNarcServer();
            console.info(this.outputString);
            return false;
        }

        // Prepare CodeNarc call then set result on NpmGroovyLint instance
        const codeNarcFactoryResult = await prepareCodeNarcCall(this.options, this.jdeployRootPath);
        this.setMethodResult(codeNarcFactoryResult);

        return true;
    }

    /* Order of attempts (supposed to work on every config):
        - Call CodeNarcServer via Http (except if --noserver)
        - Launch CodeNarcServer using com.nvuillam.CodeNarcServer, then call CodeNarcServer via Http (except if --noserver)
        - Call CodeNarc using com.nvuillam.CodeNarcServer (without launching server) (originaljdeploy.js)
        - Call CodeNarc using org.codenarc.CodeNarc (originaljdeployPlanB.js)
    */
    async callCodeNarc() {
        let serverCallResult = { status: null };
        const codeNarcCaller = new CodeNarcCaller(this.codenarcArgs, this.serverStatus, this.args, this.options, {
            jdeployFile: this.jdeployFile,
            jdeployFilePlanB: this.jdeployFilePlanB,
            jdeployRootPath: this.jdeployRootPath
        });
        if (!this.options.noserver) {
            serverCallResult = await codeNarcCaller.callCodeNarcServer();
        }
        if ([1, null].includes(serverCallResult.status)) {
            serverCallResult = await codeNarcCaller.callCodeNarcJava();
        }
        this.setMethodResult(serverCallResult);
    }

    // After CodeNarc call
    async postProcess() {
        // CodeNarc error
        if ((this.codeNarcStdErr && [null, "", undefined].includes(this.codeNarcStdOut)) || this.status > 0) {
            this.status = 1;
            console.error("GroovyLint: Error running CodeNarc: \n" + this.codeNarcStdErr);
        }
        // only --codenarcargs arguments
        else if (this.onlyCodeNarc) {
            console.log("GroovyLint: Successfully processed CodeNarc: \n" + this.codeNarcStdOut);
        }
        // process npm-groovy-lint options ( output, fix, formatting ...)
        else {
            // Parse XML result as js object
            this.lintResult = await parseCodeNarcResult(this.options, this.codeNarcBaseDir, this.tmpXmlFileName, this.tmpGroovyFileName);
            // Fix all found errors if requested
            if (this.options.fix || this.options.format) {
                this.fixer = new NpmGroovyLintFix(this.lintResult, {
                    verbose: this.options.verbose,
                    fixrules: this.options.fixrules,
                    source: this.options.source,
                    save: this.tmpGroovyFileName ? false : true
                });
                await this.fixer.run();
                this.lintResult = this.fixer.updatedLintResult;
                // If there has been fixes, call CodeNarc again to get updated error list
                if (this.fixer.fixedErrorsNumber > 0 && this.options.nolintafter !== true) {
                    await this.lintAgainAfterFix();
                }
            }
            // Output result
            this.lintResult = computeStats(this.lintResult);
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
        // Merge new linter results in existing results
        this.lintResult = this.mergeResults(this.lintResult, newLinter.lintResult);
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

    // Set lib results on this NpmGroovyLint instance
    setMethodResult(libResult) {
        for (const propName of Object.keys(libResult)) {
            this[propName] = libResult[propName];
        }
    }
}

module.exports = NpmGroovyLint;
