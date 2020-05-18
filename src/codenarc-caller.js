// Call CodeNarc by server or java
const cliProgress = require("cli-progress");
const debug = require("debug")("npm-groovy-lint");
const optionsDefinition = require("./options");
const { performance } = require("perf_hooks");
const path = require("path");
const request = require("request");
const rp = require("request-promise-native");

const { fork } = require("child_process");

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
                console.error("CodeNarcServer unexpected error:\n" + JSON.stringify(e, null, 2));
            }
            this.serverStatus = "error";
            return { status: 2, error: { msg: e.message, stack: e.stack } };
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
                status: 1,
                error: {
                    msg: "CodeNarc error",
                    msgDtl: {
                        parseErrors: parsedBody.parseErrors,
                        stdout: parsedBody.stdout,
                        stderr: parsedBody.stderr || parsedBody.errorDtl
                    }
                }
            };
        }
    }

    // Call CodeNard java class from renamed jdeploy.js
    async callCodeNarcJava(secondAttempt = false) {
        // Build jdeploy codenarc command (request to launch server for next call except if --noserver is sent)
        const jdeployFileToUse = secondAttempt ? this.execOpts.jdeployFilePlanB : this.execOpts.jdeployFile;
        const scriptPath = path.join(this.execOpts.jdeployRootPath.trim(), jdeployFileToUse);
        const scriptArgs = ["-Xms256m", "-Xmx2048m", ...this.codenarcArgs];

        // Start progress bar
        debug(`CALL CodeNarcJava with ${scriptPath} ${scriptArgs.join(" ")}`);
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
        const execRes = { stdout: "", stderr: "" };
        try {
            const cp = fork(scriptPath, scriptArgs, {
                execArgv: process.execArgv.filter(s => {
                    return !s.includes("--debug") && !s.includes("--inspect");
                }),
                silent: true
            });
            await new Promise((resolve, reject) => {
                cp.stdout.on("data", data => {
                    execRes.stdout += data + "\n";
                });
                cp.stderr.on("data", data => {
                    execRes.stderr += data + "\n";
                });
                cp.on("exit", (code, signal) => {
                    debug("Exited CodeNarcJava", { code: code, signal: signal });
                    if (code === 1) {
                        reject({ code: code, signal: signal });
                    }
                    resolve();
                });
                cp.on("error", eRun => {
                    reject(eRun);
                });
            });
        } catch (e) {
            clearInterval(this.barTimer);
            this.bar.stop();
            // If failure (missing class com.nvuillam.CodeNarcServer for example, it can happen on Linux, let's try the original org.codenarc.CodeNarc class)
            if (!secondAttempt) {
                return await this.callCodeNarcJava(true);
            } else {
                // Check if the reason is "node" missing in PATH
                if (
                    e.message &&
                    (/node(.*)is not recognized as an internal or external command/gm.test(e.message) || /node: command not found/gm.test(e.message))
                ) {
                    e.message =
                        "It seems node.js has not been found on your computer. Please install a recent node.js: https://nodejs.org/en/download/\nIf node is already installed, make sure your PATH contains node installation folder: https://love2dev.com/blog/node-is-not-recognized-as-an-internal-or-external-command/";
                } else {
                    await new Promise(resolve => {
                        require("find-java-home")(err => {
                            if (err) {
                                e.message =
                                    "Java is required to run npm-groovy-lint, as CodeNarc is written in Java/Groovy. Please install Java (version 8 minimum) https://www.java.com/download";
                            }
                            resolve();
                        });
                    });
                }
                return {
                    codeNarcStdErr: execRes.stderr,
                    status: 2,
                    error: {
                        msg: `Call CodeNarc fatal error: ${e.message} :: ${execRes.stderr}`,
                        msgDtl: {
                            stderr: execRes.stderr
                        },
                        stack: e.stack
                    }
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
        const scriptPath = path.join(this.execOpts.jdeployRootPath.trim(), this.execOpts.jdeployFile);
        const scriptArgs = ["-Xms256m", "-Xmx2048m", "--server"];
        const serverPingUri = this.getCodeNarcServerUri() + "/ping";
        let interval;
        debug(`ATTEMPT to start CodeNarcServer with ${scriptPath} ${scriptArgs.join(" ")}`);
        const execRes = { stdout: "", stderr: "" };
        try {
            // Start server using java (we don't care the promise result, as the following promise will poll the server)
            let stop = false;
            let eJava;
            const cp = fork(scriptPath, scriptArgs, {
                execArgv: process.execArgv.filter(s => {
                    return !s.includes("--debug") && !s.includes("--inspect");
                }),
                silent: true
            });
            cp.stdout.on("data", data => {
                execRes.stdout += data + "\n";
            });
            cp.stderr.on("data", data => {
                execRes.stderr += data + "\n";
            });
            cp.on("exit", (code, signal) => {
                debug("Exited CodeNarcServer", { code: code, signal: signal });
            });
            cp.on("error", eRun => {
                stop = true;
                eJava = eRun;
            });

            // Disconnect Server process from main process
            setTimeout(() => {
                cp.unref();
            }, maxAttemptTimeMs);

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
                }, 500);
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
        console.error(errMsg);
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
