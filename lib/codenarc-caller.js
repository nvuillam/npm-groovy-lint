// Call CodeNarc by server or java
import axios from "axios";
import * as cliProgress from "cli-progress";
import Debug from "debug";
const debug = Debug("npm-groovy-lint");
const trace = Debug("npm-groovy-lint-trace");
import { JavaCaller } from "java-caller";
import { optionsDefinition } from "./options.js";
import { performance } from "node:perf_hooks";
import c from "chalk";
import findJavaHome from "find-java-home";
import * as path from "path";
import { fileURLToPath } from "node:url";

// Request over IPv4 because Java typically prefers it.
import http from "http";
axios.defaults.httpAgent = new http.Agent({ family: 4, keepAlive: true });
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class CodeNarcCaller {
    args = [];
    options;
    codenarcArgs;
    javaExecutable = "java";
    additionalJavaArgs = ["-Xms256m", "-Xmx2048m"];
    execOpts;

    serverStatus;

    bar;
    barTimer;

    execTimeout = 240000;

    javaCallerOptions = {
        codeNarcServer: {
            minimumJavaVersion: 17,
            maximumJavaVersion: 17,
            rootPath: __dirname,
            jar: "java/CodeNarcServer.jar",
        },
        codeNarcJava: {
            minimumJavaVersion: 17,
            maximumJavaVersion: 17,
            rootPath: __dirname,
            jar: "java/CodeNarcServer.jar",
        },
    };

    constructor(codenarcArgs1, serverStatus1, args1, options1, execOpts1) {
        this.args = args1;
        this.codenarcArgs = codenarcArgs1;
        this.options = options1;
        this.serverStatus = serverStatus1;
        this.execOpts = execOpts1;
        this.javaExecutable = options1.javaexecutable || this.javaExecutable;
        this.additionalJavaArgs = options1.javaoptions ? options1.javaoptions.split(",") : this.additionalJavaArgs;
    }

    // Call local CodeNarc server if running
    async callCodeNarcServer(startServerTried = false) {
        // If use of --codenarcargs, get default values for CodeNarcServer host & port
        const requestUri = this.getCodeNarcServerUri() + "/request";
        // Call CodeNarc server
        const axiosConfig = {
            method: "post",
            url: requestUri,
            data: {
                codeNarcArgs: this.codenarcArgs,
                codeNarcBaseDir: this.execOpts.codeNarcBaseDir,
                codeNarcIncludes: this.execOpts.codeNarcIncludes,
                codeNarcExcludes: this.execOpts.codeNarcExcludes,
                parse: this.options.parse !== false && this.execOpts.onlyCodeNarc === false,
                fileList: this.execOpts.groovyFileName ? [this.execOpts.groovyFileName] : this.execOpts.inputFileList,
                requestKey: this.execOpts.requestKey || null,
            },
            timeout: 600000,
        };
        trace(`CALL CodeNarcServer with ${JSON.stringify(axiosConfig, null, 2)}`);
        let response;
        try {
            const startCodeNarc = performance.now();
            response = await axios.request(axiosConfig);
            this.serverStatus = "running";
            const elapsed = parseInt(performance.now() - startCodeNarc, 10);
            debug(`CodeNarcServer call result: (${response.status}) ${elapsed}ms`);
        } catch (e) {
            // If server not started , start it and try again
            debug(`callCodeNarcServer code: ${e.code} error: ${e.message}`);
            if (
                (startServerTried === false,
                e.code && ["ECONNREFUSED", "ETIMEDOUT"].includes(e.code) && ["unknown", "running"].includes(this.serverStatus)) // running is here in case the Server auto-killed itself at its expiration time
            ) {
                if ((await this.startCodeNarcServer()) && this.serverStatus === "running") {
                    return await this.callCodeNarcServer(true);
                }
            } else if (e.code === "ERR_BAD_REQUEST") {
                // Bad request.
                return {
                    status: e.response.data.statusCode,
                    error: {
                        msg: `exception: ${e.response.data.exceptionType} message: ${e.response.data.errorMessage}`,
                        stack: e.stack,
                        responseData: e.response.data.errorDtl,
                    },
                };
            } else if (e.code === "ECONNRESET") {
                // The server was shutdown just retry.
                if (startServerTried === false && (await this.startCodeNarcServer()) && this.serverStatus === "running") {
                    return await this.callCodeNarcServer(true);
                }

                // Should this really be cancelled, as the Groovy says it should return:
                // respObj.status = 'cancelledByDuplicateRequest'
                // respObj.statusCode = 444
                return {
                    status: 9,
                };
            } else {
                console.error(
                    c.red(
                        "CodeNarcServer unexpected error:\n" +
                            JSON.stringify(e, null, 2) +
                            "\n" +
                            JSON.stringify(e.response?.data?.errorDtl, null, 2),
                    ),
                );
            }
            this.serverStatus = "error";
            return {
                status: 2,
                error: {
                    msg: e.message,
                    stack: e.stack,
                    responseData: e.response?.data?.errorDtl,
                },
            };
        }

        if (response.data.status === "success") {
            // Success result
            return {
                codeNarcJsonResult: response.data.jsonResult,
                fileList: response.data.fileList,
                parseErrors: response.data.parseErrors,
                codeNarcStdOut: response.data.stdout,
                codeNarcStdErr: undefined,
                status: 0,
            };
        }

        if (response.data.status === "cancelledByDuplicateRequest") {
            // Cancelled codeNarcAction (duplicate)
            return {
                codeNarcStdOut: undefined,
                codeNarcStdErr: undefined,
                status: 9,
            };
        }

        // Codenarc error
        return {
            fileList: response.data.fileList,
            parseErrors: response.data.parseErrors,
            codeNarcJsonResult: response.data.jsonResult,
            codeNarcStdOut: response.data.stdout,
            codeNarcStdErr: response.data.errorDtl,
            status: 1,
            error: {
                msg: `exception: ${response.data.exceptionType} message: ${response.data.errorMessage}`,
                msgDtl: {
                    parseErrors: response.data.parseErrors,
                    stdout: response.data.stdout,
                    stderr: response.data.errorDtl,
                },
            },
        };
    }

    // Call CodeNard java class
    async callCodeNarcJava(secondAttempt = false) {
        // Build java codenarc command (request to launch server for next call except if --noserver is sent)
        const scriptArgs = [...this.codenarcArgs]; // Take a copy of the args so we can modify it.

        if (this.options.parse !== false && this.execOpts.onlyCodeNarc === false) {
            scriptArgs.unshift("--parse");
        }

        if (this.execOpts.groovyFileName) {
            scriptArgs.unshift("--file", this.execOpts.groovyFileName);
        } else if (this.execOpts.inputFileList) {
            this.execOpts.inputFileList.forEach((file) => {
                scriptArgs.unshift("--file", file);
            });
        }

        // Start progress bar
        trace(`CALL CodeNarcJava with ${scriptArgs.join(" ")}`);
        this.bar = new cliProgress.SingleBar(
            {
                format: "[{bar}] Running CodeNarc for {duration_formatted}",
                hideCursor: true,
                clearOnComplete: true,
            },
            cliProgress.Presets.shades_classic,
        );
        this.bar.start(10, 1);
        this.barTimer = setInterval(() => {
            this.bar.increment();
            if (this.bar.value === 9) {
                this.bar.update(1);
            }
        }, 500);

        const javaCallerMode = secondAttempt === false ? "codeNarcServer" : "codeNarcJava";

        const javaCallerOpts = this.javaCallerOptions[javaCallerMode];
        javaCallerOpts.javaExecutable = this.javaExecutable;
        javaCallerOpts.additionalJavaArgs = this.additionalJavaArgs;
        const javaCaller = new JavaCaller(javaCallerOpts);
        const javaResult = await javaCaller.run(scriptArgs, { detached: false, windowsVerbatimArguments: false });

        clearInterval(this.barTimer);
        this.bar.stop();
        if ([666, 1].includes(javaResult.status)) {
            if (!secondAttempt) {
                // If failure (missing class com.nvuillam.CodeNarcServer for example, it can happen on Linux, let's try the original org.codenarc.CodeNarc class)
                trace(`Error calling CodeNarcServer via java: ${JSON.stringify(javaResult)}`);
                return await this.callCodeNarcJava(true);
            } else {
                let reason = "Reason: unknown";
                // Check if the reason is "node" missing in PATH
                if (
                    javaResult.stderr &&
                    (/node(.*)is not recognized as an internal or external command/gm.test(javaResult.stderr) ||
                        /node: command not found/gm.test(javaResult.stderr))
                ) {
                    reason =
                        "It seems node.js has not been found on your computer. Please install a recent node.js: https://nodejs.org/en/download/\nIf node is already installed, make sure your PATH contains node installation folder: https://love2dev.com/blog/node-is-not-recognized-as-an-internal-or-external-command/";
                } else {
                    await findJavaHome({ allowJre: true }, (err) => {
                        if (err) {
                            reason =
                                "Java is required to run npm-groovy-lint, as CodeNarc is written in Java/Groovy. Please install Java (version 8 minimum) https://www.java.com/download";
                        }
                    });
                }
                return {
                    codeNarcStdErr: javaResult.stderr,
                    status: 2,
                    error: {
                        msg: `Fatal error while calling CodeNarc\n${reason}\n${javaResult.stderr}`,
                    },
                };
            }
        }

        const response = await this.getCodeNarcServerJson(javaResult.stdout);
        return {
            codeNarcJsonResult: response.jsonResult,
            fileList: response.fileList,
            parseErrors: response.parseErrors,
            codeNarcStdOut: javaResult.stdout,
            codeNarcStdErr: javaResult.stderr,
            status: 0,
        };
    }

    // Start CodeNarc server so it can be called via Http just after
    async startCodeNarcServer() {
        this.serverStatus = "unknown";
        const maxAttemptTimeMs = 10000;
        const scriptArgs = ["--server"];
        const serverPingUri = this.getCodeNarcServerUri() + "/ping";

        debug(`ATTEMPT to start CodeNarcServer with ${scriptArgs.join(" ")}`);

        // Start server using java (we don't care the promise result, as the following promise will poll the server)
        const javaCallerOpts = this.javaCallerOptions["codeNarcServer"];
        javaCallerOpts.javaExecutable = this.javaExecutable;
        javaCallerOpts.additionalJavaArgs = this.additionalJavaArgs;
        const javaCaller = new JavaCaller(javaCallerOpts);
        const javaResult = await javaCaller.run(scriptArgs, { detached: true, waitForErrorMs: 500 });

        // Store the process so we can stop it later.
        this.codeNarcProcess = javaResult.childJavaProcess;

        trace(`javaResult: ${JSON.stringify(javaResult)}`);

        if ([666, 1].includes(javaResult.status)) {
            console.error(c.red(`Unable to start CodeNarc server: ${JSON.stringify(javaResult)}`));
            console.error(c.grey(JSON.stringify(scriptArgs)));
            this.serverStatus = "error";
            return false;
        }

        // Poll it until it is ready
        const start = performance.now();
        let notified = false;
        let interval;
        await new Promise((resolve) => {
            interval = setInterval(() => {
                debug(
                    `pinging CodeNarcServer at ${serverPingUri} notified: ${notified}, serverStatus: ${
                        this.serverStatus
                    }, since: ${performance.now() - start}, maxAttemptTimeMs: ${maxAttemptTimeMs}`,
                );
                axios
                    .get(serverPingUri)
                    .then((response) => {
                        if (response.status === 200) {
                            // Server is correctly started, as he replied to the ping request
                            this.serverStatus = "running";
                            if (notified === false) {
                                notified = true;
                                debug(`SUCCESS: CodeNarcServer is running`);
                                clearInterval(interval);
                                resolve();
                            }
                        } else if (notified === false && this.serverStatus === "unknown" && performance.now() - start > maxAttemptTimeMs) {
                            // Timeout has been reached.
                            let since = performance.now() - start;
                            debug(`Ping timeout after ${since}ms status: ${response.status}`);
                            this.declareServerError({ message: `Timeout after ${since}ms} status: ${response.status}` }, interval);
                            resolve();
                        }
                    })
                    .catch((e) => {
                        debug(`Ping code: ${e.code} message: ${e.message}`);
                        let since = performance.now() - start;
                        if (notified === false && this.serverStatus === "unknown" && since > maxAttemptTimeMs) {
                            // Timeout has been reached
                            debug(`Ping timeout after ${maxAttemptTimeMs}ms`);
                            this.declareServerError({ message: `Timeout after ${since}ms error: ${e}` }, interval);
                            resolve();
                        }
                    });
            }, 400);
        });

        if (this.serverStatus === "running") {
            debug(c.green(`GroovyLint: Started CodeNarc Server`));
            return true;
        }
        return false;
    }

    // Kill CodeNarc process if running.
    killCodeNarcProcess() {
        if (this.codeNarcProcess) {
            this.codeNarcProcess.kill("SIGKILL");
            delete this.codeNarcProcess;
            return "CodeNarcServer killed";
        }
        return "";
    }

    // Stop polling and log error
    declareServerError(e, interval) {
        // Kill off the process as it is not responding.
        this.killCodeNarcProcess();

        this.serverStatus = "error";
        if (interval) {
            clearInterval(interval);
        }
        const errMsg = "GroovyLint: Unable to start CodeNarc Server. Use --noserver if you do not even want to try";
        debug(errMsg);
        debug(e.message);
        console.error(c.grey(errMsg));
    }

    // Kill CodeNarc server.
    async killCodeNarcServer() {
        // Try by process first as it's more reliable.
        let outputString = this.killCodeNarcProcess();
        if (outputString) {
            return outputString;
        }

        // Process kill wasn't possible, so try sending a kill http request.
        const killUri = this.getCodeNarcServerUri() + "/kill";
        try {
            const response = await axios.post(killUri, { timeout: 1000 });
            if (response.data.status === "killed") {
                outputString = "CodeNarcServer terminated";
            } else {
                outputString = "Error killing CodeNarcServer";
            }
        } catch (e) {
            if (e.stack.includes("connResetException") || e.message.includes("socket hang up")) {
                outputString = "CodeNarcServer terminated";
            } else {
                // This should be ECONNREFUSED.
                debug(`CodeNarcServer kill request failed: ${e}`);
                outputString = `CodeNarcServer was not running`;
            }
        }

        // Wait for the server to stop otherwise when we try to start it
        // again it it's likely to fail due to an port in use error.
        const serverPingUri = this.getCodeNarcServerUri() + "/ping";

        let interval;
        await new Promise((resolve) => {
            interval = setInterval(() => {
                debug(`pinging CodeNarcServer at ${serverPingUri} serverStatus: ${this.serverStatus}`);
                axios
                    .get(serverPingUri)
                    .then((response) => {
                        debug(`ping response: ${response.status}`);
                    })
                    .catch((e) => {
                        debug(`Ping code: ${e.code} message: ${e.message}`);
                        clearInterval(interval);
                        resolve();
                    });
            }, 400);
        });

        trace(`killCodeNarcServer: ${outputString}`);

        return outputString;
    }

    // Return CodeNarc server URI
    getCodeNarcServerUri() {
        // If use of --codenarcargs, get default values for CodeNarcServer host & port
        const serverOptions = optionsDefinition.parse({});
        return (this.options.serverhost || serverOptions.serverhost) + ":" + (this.options.serverport || serverOptions.serverport);
    }

    /**
     * Parse JSON result from CodeNarcServer.
     *
     * @param {string} response the response from CodeNarcServer
     * @returns {Promise<*>}
     * @private
     */
    async getCodeNarcServerJson(response) {
        try {
            return JSON.parse(response);
        } catch (e) {
            return { err: `Unable to parse ${response}: ${e.message}` };
        }
    }
}
