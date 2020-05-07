// Call CodeNarc by server or java
const cliProgress = require("cli-progress");
const debug = require("debug")("npm-groovy-lint");
const optionsDefinition = require("./options");
const { performance } = require("perf_hooks");
const request = require("request");
const rp = require("request-promise-native");
const util = require("util");

const exec = util.promisify(require("child_process").exec);

class CodeNarcCaller {
    "use strict";

    args = [];
    options;
    codenarcArgs;
    execOpts;

    serverStatus;

    bar;
    barTimer;

    execTimeout = 240000;

    constructor(codenarcArgs1, serverStatus1, args1, options1, execOpts1) {
        this.args = args1;
        this.codenarcArgs = codenarcArgs1;
        this.options = options1;
        this.serverStatus = serverStatus1;
        this.execOpts = execOpts1;
    }

    // Call local CodeNarc server if running
    async callCodeNarcServer() {
        // If use of --codenarcargs, get default values for CodeNarcServer host & port
        const requestUri = this.getCodeNarcServerUri() + "/request";
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
            uri: requestUri,
            body: {
                codeNarcArgs: codeNarcArgsString,
                parse: this.options.parse ? true : false,
                file: this.execOpts.groovyFileName ? this.execOpts.groovyFileName : null,
                requestKey: this.execOpts.requestKey || null
            },
            timeout: 360000,
            json: true
        };
        debug(`CALL CodeNarcServer with ${JSON.stringify(rqstOptions, null, 2)}`);
        let parsedBody = null;
        try {
            const startCodeNarc = performance.now();
            parsedBody = await rp(rqstOptions);
            this.serverStatus = "running";
            const elapsed = parseInt(performance.now() - startCodeNarc, 10);
            debug(`CodeNarc run in ${elapsed} ms and returned ${JSON.stringify(parsedBody)}`);
        } catch (e) {
            // If server not started , start it and try again
            if (
                e.message &&
                (e.message.includes("ECONNREFUSED") || e.message.includes("ETIMEDOUT")) &&
                ["unknown", "running"].includes(this.serverStatus) &&
                (await this.startCodeNarcServer())
            ) {
                if (this.serverStatus === "running") {
                    return await this.callCodeNarcServer();
                }
            }
            // Cancelled codeNarcAction (duplicate)
            else if (e.cause && e.cause.code == "ECONNRESET") {
                return {
                    status: 9
                };
            } else {
                console.error("CodeNarcServer http call unexpected error:\n" + JSON.stringify(e, null, 2));
            }
            this.serverStatus = "error";
            return { status: 1 };
        }

        // Success result
        if (parsedBody.status === "success") {
            return {
                parseErrors: parsedBody.parseErrors,
                codeNarcStdOut: parsedBody.stdout,
                codeNarcStdErr: parsedBody.stderr,
                status: 0
            };
        }
        // Cancelled codeNarcAction (duplicate) (TODO: Update CodeNarcServer.groovy to cleanly stop task and not kill the thread !)
        else if (parsedBody.status === "cancelledByDuplicateRequest") {
            return {
                codeNarcStdOut: parsedBody.stdout,
                codeNarcStdErr: parsedBody.stderr,
                status: 9
            };
        }
        // Codenarc error
        else {
            return {
                parseErrors: parsedBody.parseErrors,
                codeNarcStdOut: parsedBody.stdout,
                codeNarcStdErr: parsedBody.stderr || parsedBody.errorDtl,
                status: 1
            };
        }
    }

    // Call CodeNard java class from renamed jdeploy.js
    async callCodeNarcJava(secondAttempt = false) {
        // Build jdeploy codenarc command (request to launch server for next call except if --noserver is sent)
        const nodeExe = this.args[0] && this.args[0].includes("node") ? this.args[0] : "node";
        const jdeployFileToUse = secondAttempt ? this.execOpts.jdeployFilePlanB : this.execOpts.jdeployFile;
        const jDeployCommand =
            '"' + nodeExe + '" "' + this.execOpts.jdeployRootPath.trim() + "/" + jdeployFileToUse + '" ' + this.codenarcArgs.join(" ");

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
                return {
                    codeNarcStdErr: e.stderr || e.message,
                    status: 1
                };
            }
        }

        // Stop progress bar
        clearInterval(this.barTimer);
        this.bar.stop();

        return {
            codeNarcStdOut: execRes.stdout,
            codeNarcStdErr: execRes.stderr,
            status: 0
        };
    }

    // Start CodeNarc server so it can be called via Http just after
    async startCodeNarcServer() {
        this.serverStatus = "unknown";
        const maxAttemptTimeMs = 10000;
        let attempts = 1;
        const nodeExe = this.args[0] && this.args[0].includes("node") ? this.args[0] : "node";
        const jDeployCommand = '"' + nodeExe + '" "' + this.execOpts.jdeployRootPath.trim() + "/" + this.execOpts.jdeployFile + '" --server';
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
            let notified = false;
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
                                if (notified === false) {
                                    debug(`SUCCESS: CodeNarcServer is running`);
                                    notified = true;
                                }
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
            console.log(`GroovyLint: Started CodeNarc Server after ${attempts} attempts`);
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
        const errMsg = "GroovyLint: Unable to start CodeNarc Server. Use --noserver if you do not even want to try";
        debug(errMsg);
        debug(e.message);
        console.log(errMsg);
    }

    // Kill CodeNarc server by telling it to do so
    async killCodeNarcServer() {
        const serverUri = this.getCodeNarcServerUri() + "/kill";
        let outputString = "";
        try {
            const parsedBody = await rp({
                method: "POST",
                uri: serverUri,
                timeout: 5000,
                json: true
            });
            if (parsedBody.status === "killed") {
                outputString = "CodeNarcServer terminated";
            } else {
                outputString = "Error killing CodeNarcServer";
            }
        } catch (e) {
            if (e.message.includes("socket hang up")) {
                outputString = "CodeNarcServer terminated";
            } else {
                outputString = "CodeNarcServer was not running";
            }
        }
        return outputString;
    }

    // Return CodeNarc server URI
    getCodeNarcServerUri() {
        // If use of --codenarcargs, get default values for CodeNarcServer host & port
        const serverOptions = optionsDefinition.parse({});
        return (this.options.serverhost || serverOptions.serverhost) + ":" + (this.options.serverport || serverOptions.serverport);
    }
}

module.exports = CodeNarcCaller;
