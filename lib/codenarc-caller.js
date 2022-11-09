// Call CodeNarc by server or java
const axios = require("axios").default;
const cliProgress = require("cli-progress");
const debug = require("debug")("npm-groovy-lint");
const { JavaCaller } = require("java-caller");
const optionsDefinition = require("./options");
const { performance } = require("perf_hooks");
const { getSourceLines } = require("./utils");
const c = require("chalk");

class CodeNarcCaller {
    "use strict";

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
            minimumJavaVersion: 8,
            rootPath: __dirname,
            mainClass: "com.nvuillam.CodeNarcServer",
            classPath: "java/CodeNarcServer.jar:java/*"
        },
        codeNarcJava: {
            minimumJavaVersion: 8,
            rootPath: __dirname,
            mainClass: "org.codenarc.CodeNarc",
            classPath:
                "java/CodeNarc-3.1.0.jar:java/groovy/lib/groovy-3.0.9.jar:java/groovy/lib/groovy-templates-3.0.9.jar:java/groovy/lib/groovy-xml-3.0.9.jar:java/groovy/lib/groovy-json-3.0.9.jar:java/groovy/lib/groovy-ant-3.0.9.jar:java/groovy/lib/ant-1.10.11.jar:java/groovy/lib/ant-launcher-1.10.11.jar:java/slf4j-api-1.7.9.jar:java/log4j-slf4j-impl-2.18.0.jar:java/log4j-api-2.18.0.jar:java/log4j-core-2.18.0.jar:java/GMetrics-2.1.0.jar:java/*"
        }
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
        // Remove "" around values because they won't get thru system command line parser
        const codeNarcArgsForServer = this.codenarcArgs.map(codeNarcArg => {
            if (codeNarcArg.includes('="') || codeNarcArg.includes(':"')) {
                codeNarcArg = codeNarcArg
                    .replace('="', "=")
                    .replace(':"', ":")
                    .replace(/ /g, "%20");
                codeNarcArg = codeNarcArg.substring(0, codeNarcArg.length - 1);
            }
            return codeNarcArg;
        });
        // Call CodeNarc server
        const codeNarcArgsString = codeNarcArgsForServer.join(" ");
        const axiosConfigData = {
            codeNarcArgs: codeNarcArgsString,
            codeNarcBaseDir: this.execOpts.codeNarcBaseDir,
            codeNarcIncludes: this.execOpts.codeNarcIncludes,
            codeNarcExcludes: this.execOpts.codeNarcExcludes,
            parse: this.options.parse !== false && this.execOpts.onlyCodeNarc === false ? true : false,
            file: this.execOpts.groovyFileName || null,
            fileList: this.execOpts.inputFileList || null
        }
        if (this.execOpts.requestKey) {
            axiosConfigData.requestKey = this.execOpts.requestKey 
        }
        const axiosConfig = {
            method: "post",
            url: requestUri,
            data: axiosConfigData,
            timeout: 600000
        };
        debug(`CALL CodeNarcServer with ${JSON.stringify(axiosConfig, null, 2)}`);
        let response;
        try {
            const startCodeNarc = performance.now();
            response = await axios.request(axiosConfig);
            this.serverStatus = "running";
            const elapsed = parseInt(performance.now() - startCodeNarc, 10);
            debug(`CodeNarcServer call result: (${response.status}) ${elapsed}ms ${JSON.stringify(response.data || {})}`);
        } catch (e) {
            // If server not started , start it and try again
            if (
                (startServerTried === false,
                e.code && ["ECONNREFUSED", "ETIMEDOUT"].includes(e.code) && ["unknown", "running"].includes(this.serverStatus)) // running is here in case the Server auto-killed itself at its expiration time
            ) {
                if ((await this.startCodeNarcServer()) && this.serverStatus === "running") {
                    return await this.callCodeNarcServer(true);
                }
            }
            // Cancelled codeNarcAction (duplicate)
            else if (e.code && e.code === "ECONNRESET") {
                return {
                    status: 9
                };
            } else {
                console.error(
                    c.red(
                        "CodeNarcServer unexpected error:\n" +
                            JSON.stringify(e, null, 2) +
                            "\n" +
                            (e.response && e.response.data && e.response.data.errorDtl
                                ? JSON.stringify(e.response.data.errorDtl, null, 2)
                                : undefined)
                    )
                );
            }
            this.serverStatus = "error";
            return {
                status: 2,
                error: {
                    msg: e.message,
                    stack: e.stack,
                    responseData: e.response && e.response.data && e.response.data.errorDtl ? e.response.data.errorDtl : undefined
                }
            };
        }

        // Success result
        if (response.data && response.data.status === "success") {
            return {
                codeNarcJsonResult: await this.getCodeNarcJsonResult(response),
                fileList: response.data.fileList,
                parseErrors: response.data.parseErrors,
                codeNarcStdOut: response.data.stdout,
                codeNarcStdErr: response.data.stderr,
                status: 0
            };
        }
        /*
        // Cancelled codeNarcAction (duplicate) (TODO: Update CodeNarcServer.groovy to cleanly stop task and not kill the thread !)
        else if (response.data && response.data.status === "cancelledByDuplicateRequest") {
            return {
                codeNarcStdOut: response.data.stdout,
                codeNarcStdErr: response.data.stderr,
                status: 9
            };
        }*/
        // Codenarc error
        else {
            return {
                fileList: response.data.fileList,
                parseErrors: response.data.parseErrors,
                codeNarcJsonResult: await this.getCodeNarcJsonResult(response),
                codeNarcStdOut: response.data.stdout,
                codeNarcStdErr: response.data.stderr || response.data.errorDtl,
                status: 1,
                error: {
                    msg: "CodeNarc error",
                    msgDtl: {
                        parseErrors: response.data.parseErrors,
                        stdout: response.data.stdout,
                        stderr: response.data.stderr || response.data.errorDtl
                    }
                }
            };
        }
    }

    // Call CodeNard java class
    async callCodeNarcJava(secondAttempt = false) {
        // Build java codenarc command (request to launch server for next call except if --noserver is sent)
        const scriptArgs = this.codenarcArgs;

        // Start progress bar
        debug(`CALL CodeNarcJava with ${scriptArgs.join(" ")}`);
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

        const javaCallerMode = secondAttempt === false ? "codeNarcServer" : "codeNarcJava";

        const javaCallerOpts = this.javaCallerOptions[javaCallerMode];
        javaCallerOpts.javaExecutable = this.javaExecutable;
        javaCallerOpts.additionalJavaArgs = this.additionalJavaArgs;
        const javaCaller = new JavaCaller(javaCallerOpts);
        const javaResult = await javaCaller.run(scriptArgs, { detached: false });

        clearInterval(this.barTimer);
        this.bar.stop();
        if ([666, 1].includes(javaResult.status)) {
            if (!secondAttempt) {
                // If failure (missing class com.nvuillam.CodeNarcServer for example, it can happen on Linux, let's try the original org.codenarc.CodeNarc class)
                debug(`Error calling CodeNarcServer via java: ${JSON.stringify(javaResult)}`);
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
                    await new Promise(resolve => {
                        require("find-java-home")(err => {
                            if (err) {
                                reason =
                                    "Java is required to run npm-groovy-lint, as CodeNarc is written in Java/Groovy. Please install Java (version 8 minimum) https://www.java.com/download";
                            }
                            resolve();
                        });
                    });
                }
                return {
                    codeNarcStdErr: javaResult.stderr,
                    status: 2,
                    error: {
                        msg: `Fatal error while calling CodeNarc\n${reason}\n${javaResult.stderr}`
                    }
                };
            }
        }

        return {
            codeNarcJsonResult: await this.getCodeNarcJsonResult(javaResult.stdout),
            codeNarcStdOut: javaResult.stdout,
            codeNarcStdErr: javaResult.stderr,
            status: 0
        };
    }

    // Start CodeNarc server so it can be called via Http just after
    async startCodeNarcServer() {
        this.serverStatus = "unknown";
        const maxAttemptTimeMs = 20000;
        const scriptArgs = ["--server"];
        const serverPingUri = this.getCodeNarcServerUri() + "/ping";

        debug(`ATTEMPT to start CodeNarcServer with ${scriptArgs.join(" ")}`);

        // Start server using java (we don't care the promise result, as the following promise will poll the server)
        const javaCallerOpts = this.javaCallerOptions["codeNarcServer"];
        javaCallerOpts.javaExecutable = this.javaExecutable;
        javaCallerOpts.additionalJavaArgs = this.additionalJavaArgs;
        const javaCaller = new JavaCaller(javaCallerOpts);
        const javaCallRes = await javaCaller.run(scriptArgs, { detached: true, waitForErrorMs: 500 });

        if ([666, 1].includes(javaCallRes.status)) {
            console.error(c.red(`Unable to start CodeNarc server: ${JSON.stringify(javaCallRes)}`));
            console.error(c.grey(JSON.stringify(scriptArgs)));
            this.serverStatus = "error";
            return false;
        }

        // Poll it until it is ready
        const start = performance.now();
        let notified = false;
        let interval;
        await new Promise(resolve => {
            interval = setInterval(() => {
                axios
                    .get(serverPingUri)
                    .then(response => {
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
                            // Timeout has been reached
                            this.declareServerError(
                                {
                                    message: "Timeout after " + maxAttemptTimeMs + "\nResponse: " + JSON.stringify(response.toJSON())
                                },
                                interval
                            );
                            resolve();
                        }
                    })
                    .catch(() => {
                        // Just do nothing
                    });
            }, 400);
        });

        if (this.serverStatus === "running") {
            debug(c.green(`GroovyLint: Started CodeNarc Server`));
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
        console.error(c.grey(errMsg));
    }

    // Kill CodeNarc server by telling it to do so
    async killCodeNarcServer() {
        const serverUri = this.getCodeNarcServerUri() + "/kill";
        let outputString = "";
        try {
            const response = await axios.post(serverUri, { timeout: 5000 });
            if (response.data.status === "killed") {
                outputString = "CodeNarcServer terminated";
            } else {
                outputString = "Error killing CodeNarcServer";
            }
        } catch (e) {
            if (e.stack.includes("connResetException")) {
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

    // Retrieve JSON result in CodeNarc stdout
    async getCodeNarcJsonResult(response) {
        const stdout = typeof response === "string" ? response : response && response.data && response.data.stdout ? response.data.stdout : null;
        if (stdout) {
            const outputLineLs = await getSourceLines(stdout);
            const jsonLine = outputLineLs[1] && outputLineLs[1].startsWith("{") ? outputLineLs[1] : outputLineLs[0];
            try {
                return JSON.parse(jsonLine);
            } catch (e) {
                return { err: "Unable to parse " + stdout };
            }
        }
        return {};
    }
}

module.exports = CodeNarcCaller;
