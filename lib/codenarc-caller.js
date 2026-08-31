// Call CodeNarc by server or java
import { ProgressBar } from "./progress-bar.js";
import { debuglog, styleText } from "node:util";
const debug = debuglog("npm-groovy-lint");
const trace = debuglog("npm-groovy-lint-trace");
import { JavaCaller } from "java-caller";
import { optionsDefinition } from "./options.js";
import { performance } from "node:perf_hooks";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// True when a CodeNarcServer error response looks like Jackson failing to deserialize the request
// payload: the running server predates this client and rejects a JSON field the client now sends
// (its ObjectMapper fails on unknown properties). Only restarting the server - which then runs the
// newly installed jar - can fix it; falling back to a direct java call would silently cost a JVM
// cold start on every single lint until the stale server idles out.
// Exported for tests.
export function isStaleServerResponse(responseData) {
    const exceptionType = responseData?.exceptionType || "";
    const errorMessage = responseData?.errorMessage || "";
    return (
        exceptionType.includes("UnrecognizedPropertyException") ||
        exceptionType.includes("MismatchedInputException") ||
        exceptionType.includes("JsonMappingException") ||
        errorMessage.includes("Unrecognized field")
    );
}

// Extract the low-level error code from a fetch error (fetch wraps network errors in a TypeError with a cause)
function getErrorCode(e) {
    if (e?.name === "TimeoutError" || e?.cause?.name === "TimeoutError") {
        // AbortSignal.timeout reached: the request deadline expired. Distinct from an OS-level connect
        // ETIMEDOUT: restarting the server would not help, the caller should fall back to direct java call.
        return "ETIMEDOUT_REQUEST";
    }
    return e?.cause?.code || e?.code;
}

export class CodeNarcCaller {
    args = [];
    options;
    codenarcArgs;
    javaExecutable = "java";
    additionalJavaArgs = ["-Xms256m", "-Xmx4096m"];
    execOpts;

    serverStatus;

    bar;
    barTimer;

    execTimeout = 240000;

    // Java version requirements: minimum 17, maximum 24 (accepts any Java 17+ version)
    javaCallerOptions = {
        codeNarcServer: {
            minimumJavaVersion: 17,
            maximumJavaVersion: 24,
            rootPath: __dirname,
            jar: "java/CodeNarcServer.jar",
        },
        codeNarcJava: {
            minimumJavaVersion: 17,
            maximumJavaVersion: 24,
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
        const requestData = {
            codeNarcArgs: this.codenarcArgs,
            codeNarcBaseDir: this.execOpts.codeNarcBaseDir,
            codeNarcIncludes: this.execOpts.codeNarcIncludes,
            codeNarcExcludes: this.execOpts.codeNarcExcludes,
            parse: this.options.parse !== false && this.execOpts.onlyCodeNarc === false,
            fileList: this.execOpts.groovyFileName ? [this.execOpts.groovyFileName] : this.execOpts.inputFileList,
            requestKey: this.execOpts.requestKey || null,
            parallelism: this.options.parallelism || null,
        };
        trace(`CALL CodeNarcServer at ${requestUri} with ${JSON.stringify(requestData, null, 2)}`);
        let responseData;
        try {
            const startCodeNarc = performance.now();
            const response = await fetch(requestUri, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify(requestData),
                signal: AbortSignal.timeout(120000),
            });
            // Read the body as text first: a connection reset or timeout while the body is streaming must
            // reach the catch block below (which owns the restart/retry/timeout handling), while a non-JSON
            // body (e.g. another process bound on the port) is handled quietly by the CodeNarc error return
            const responseText = await response.text();
            try {
                responseData = JSON.parse(responseText);
            } catch {
                responseData = {};
            }
            // Request cancelled by the server because a more recent duplicate request arrived (HTTP 444)
            if (response.status === 444 || responseData?.status === "cancelledByDuplicateRequest") {
                return {
                    status: 9,
                    cancelledWorkers: responseData?.cancelledWorkers,
                };
            }
            if (response.status >= 500 && startServerTried === false && isStaleServerResponse(responseData)) {
                // A still-running server from a previous npm-groovy-lint version rejected the request
                // payload. Kill it and start a fresh server on the newly installed jar, then retry once.
                debug(`CodeNarcServer rejected the request payload (stale server), restarting it: ${responseData?.errorMessage}`);
                await this.killCodeNarcServer();
                if ((await this.startCodeNarcServer()) && this.serverStatus === "running") {
                    return await this.callCodeNarcServer(true);
                }
            }
            if (!response.ok) {
                // Error status returned by CodeNarcServer: server-side errors (HTTP 5xx) map to status 2
                // so the caller falls back to a direct java call; invalid requests (HTTP 4xx) keep the
                // statusCode sent by the server
                return {
                    codeNarcStdErr: responseData?.errorDtl,
                    status: response.status >= 500 ? 2 : (responseData?.statusCode ?? 2),
                    error: {
                        msg: `exception: ${responseData?.exceptionType} message: ${responseData?.errorMessage}`,
                        stack: new Error(`CodeNarcServer HTTP ${response.status}`).stack,
                        responseData: responseData?.errorDtl,
                    },
                };
            }
            this.serverStatus = "running";
            const elapsed = parseInt(performance.now() - startCodeNarc, 10);
            debug(`CodeNarcServer call result: (${response.status}) ${elapsed}ms`);
        } catch (e) {
            const errCode = getErrorCode(e);
            // If server not started , start it and try again
            debug(`callCodeNarcServer code: ${errCode} error: ${e.message}`);
            if (
                startServerTried === false &&
                errCode &&
                ["ECONNREFUSED", "ETIMEDOUT"].includes(errCode) &&
                ["unknown", "running"].includes(this.serverStatus) // running is here in case the Server auto-killed itself at its expiration time
            ) {
                if ((await this.startCodeNarcServer()) && this.serverStatus === "running") {
                    return await this.callCodeNarcServer(true);
                }
            } else if (["ECONNRESET", "UND_ERR_SOCKET"].includes(errCode)) {
                // The server was shutdown just retry.
                if (startServerTried === false && (await this.startCodeNarcServer()) && this.serverStatus === "running") {
                    return await this.callCodeNarcServer(true);
                }

                // A dropped connection only means "cancelled by a duplicate request" when this call carries
                // a requestKey, the identifier the server uses to detect duplicates (a duplicate is normally
                // answered with an HTTP 444, handled above). Without a requestKey there is nothing that could
                // have cancelled the call, so the socket died for another reason (JVM crash, out of memory):
                // fall through to status 2 so the caller retries with a direct java call.
                if (this.execOpts.requestKey) {
                    return {
                        status: 9,
                    };
                }
            } else if (errCode === "ETIMEDOUT_REQUEST") {
                // Request deadline expired: do not restart the server, let the caller fall back to direct java call
                debug(`CodeNarcServer request timed out, falling back to direct java call`);
            } else if (["ECONNREFUSED", "ETIMEDOUT"].includes(errCode)) {
                // Server unreachable on the retry, or we already tried to restart it: this is an ordinary
                // failure, so stay quiet and let the caller fall back to a direct java call rather than
                // dumping a red stack trace on a run that then succeeds
                debug(`CodeNarcServer unreachable (${errCode}), falling back to direct java call`);
            } else {
                console.error(
                    styleText(
                        "red",
                        "CodeNarcServer unexpected error:\n" +
                            JSON.stringify(e, Object.getOwnPropertyNames(e), 2) +
                            "\n" +
                            (e.cause ? String(e.cause) : ""),
                    ),
                );
            }
            this.serverStatus = "error";
            return {
                status: 2,
                error: {
                    msg: e.message,
                    stack: e.stack,
                },
            };
        }

        if (responseData.status === "success") {
            // Success result
            return {
                codeNarcJsonResult: responseData.jsonResult,
                fileList: responseData.fileList,
                parseErrors: responseData.parseErrors,
                codeNarcStdOut: responseData.stdout,
                codeNarcStdErr: undefined,
                partitionCount: responseData.partitionCount,
                cacheHits: responseData.cacheHits,
                cacheMisses: responseData.cacheMisses,
                status: 0,
            };
        }

        // Codenarc error
        return {
            fileList: responseData.fileList,
            parseErrors: responseData.parseErrors,
            codeNarcJsonResult: responseData.jsonResult,
            codeNarcStdOut: responseData.stdout,
            codeNarcStdErr: responseData.errorDtl,
            status: 1,
            error: {
                msg: `exception: ${responseData.exceptionType} message: ${responseData.errorMessage}`,
                msgDtl: {
                    parseErrors: responseData.parseErrors,
                    stdout: responseData.stdout,
                    stderr: responseData.errorDtl,
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

        // Without this, --noserver (and the silent java fallback) would ignore an explicit
        // --parallelism and always analyse with the auto partition count.
        if (this.options.parallelism) {
            scriptArgs.unshift("--parallelism", String(this.options.parallelism));
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
        this.bar = new ProgressBar({
            format: "[{bar}] Running CodeNarc for {duration_formatted}",
            hideCursor: true,
            clearOnComplete: true,
        });
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
        let javaResult;
        try {
            javaResult = await javaCaller.run(scriptArgs, { detached: false, windowsVerbatimArguments: false });
        } finally {
            // Always stop the bar: its timer keeps firing and it hides the terminal cursor
            clearInterval(this.barTimer);
            this.bar.stop();
        }
        if ([666, 1].includes(javaResult.status)) {
            if (!secondAttempt) {
                // If failure (missing class com.nvuillam.CodeNarcServer for example, it can happen on Linux, let's try the original org.codenarc.CodeNarc class)
                trace(`Error calling CodeNarcServer via java: ${JSON.stringify(javaResult)}`);
                return await this.callCodeNarcJava(true);
            } else {
                let reason;
                // Check if the reason is "node" missing in PATH
                if (
                    javaResult.stderr &&
                    (/node(.*)is not recognized as an internal or external command/gm.test(javaResult.stderr) ||
                        /node: command not found/gm.test(javaResult.stderr))
                ) {
                    reason =
                        "It seems node.js has not been found on your computer. Please install a recent node.js: https://nodejs.org/en/download/\nIf node is already installed, make sure your PATH contains node installation folder: https://love2dev.com/blog/node-is-not-recognized-as-an-internal-or-external-command/";
                } else {
                    reason =
                        "If the error below mentions Java, please verify that Java (version 17 minimum) is installed and available in your PATH: https://www.java.com/download";
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
            partitionCount: response.partitionCount,
            cacheHits: response.cacheHits,
            cacheMisses: response.cacheMisses,
            status: 0,
        };
    }

    // Start CodeNarc server so it can be called via Http just after
    async startCodeNarcServer() {
        this.serverStatus = "unknown";
        const maxAttemptTimeMs = 10000;
        // The token file path is computed here (from os.tmpdir()) and handed to the server, so
        // that other npm-groovy-lint processes of the same OS user can later find the token to
        // authorize their --killserver, even where java.io.tmpdir and os.tmpdir() differ.
        // On Windows, java-caller spawns with windowsVerbatimArguments (its default) and only
        // quotes the jar path itself: quote the token path the same way, or a user profile
        // containing a space (C:\Users\First Last\...) would split the argument and leave the
        // server without a usable token file.
        const tokenFilePath = this.getKillTokenFilePath();
        const scriptArgs = ["--server", "--tokenfile", process.platform === "win32" ? `"${tokenFilePath}"` : tokenFilePath];
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
            console.error(styleText("red", `Unable to start CodeNarc server: ${JSON.stringify(javaResult)}`));
            console.error(styleText("gray", JSON.stringify(scriptArgs)));
            this.serverStatus = "error";
            return false;
        }

        // Poll it until it is ready, using exponential backoff starting at 50ms
        const start = performance.now();
        let notified = false;
        let pollDelay = 50;
        await new Promise((resolve) => {
            // Stop polling early if the server process exits unexpectedly
            const onProcessExit = (code) => {
                if (!notified) {
                    notified = true;
                    debug(`CodeNarcServer process exited with code ${code} before becoming ready`);
                    this.serverStatus = "error";
                    resolve();
                }
            };
            this.codeNarcProcess?.on("exit", onProcessExit);

            const cleanup = () => {
                this.codeNarcProcess?.removeListener("exit", onProcessExit);
            };

            const poll = () => {
                if (notified) {
                    return; // Already resolved (e.g. process exited)
                }
                debug(
                    `pinging CodeNarcServer at ${serverPingUri} notified: ${notified}, serverStatus: ${
                        this.serverStatus
                    }, since: ${performance.now() - start}, maxAttemptTimeMs: ${maxAttemptTimeMs}`,
                );
                // The deadline below is only evaluated once a ping settles: without a timeout, a JVM that
                // binds the port but never answers (long GC pause, deadlock) would hang the poll forever
                fetch(serverPingUri, { signal: AbortSignal.timeout(5000) })
                    .then((response) => {
                        // Ping bodies are never used: discard them so the connection is released right away
                        response.body?.cancel().catch(() => {});
                        if (response.status === 200) {
                            // Server is correctly started, as he replied to the ping request
                            this.serverStatus = "running";
                            if (notified === false) {
                                notified = true;
                                debug(`SUCCESS: CodeNarcServer is running`);
                                cleanup();
                                resolve();
                            }
                        } else if (notified === false && this.serverStatus === "unknown" && performance.now() - start > maxAttemptTimeMs) {
                            // Timeout has been reached.
                            let since = performance.now() - start;
                            debug(`Ping timeout after ${since}ms status: ${response.status}`);
                            cleanup();
                            this.declareServerError({ message: `Timeout after ${since}ms} status: ${response.status}` });
                            resolve();
                        } else {
                            scheduleNext();
                        }
                    })
                    .catch((e) => {
                        debug(`Ping code: ${getErrorCode(e)} message: ${e.message}`);
                        let since = performance.now() - start;
                        if (notified === false && this.serverStatus === "unknown" && since > maxAttemptTimeMs) {
                            // Timeout has been reached
                            debug(`Ping timeout after ${maxAttemptTimeMs}ms`);
                            cleanup();
                            this.declareServerError({ message: `Timeout after ${since}ms error: ${e}` });
                            resolve();
                        } else {
                            scheduleNext();
                        }
                    });
            };
            const scheduleNext = () => {
                setTimeout(poll, pollDelay);
                pollDelay = Math.min(pollDelay * 2, 400); // exponential backoff, cap at 400ms
            };
            poll();
        });

        if (this.serverStatus === "running") {
            debug(styleText("green", `GroovyLint: Started CodeNarc Server`));
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
    declareServerError(e) {
        // Kill off the process as it is not responding.
        this.killCodeNarcProcess();

        this.serverStatus = "error";
        const errMsg = "GroovyLint: Unable to start CodeNarc Server. Use --noserver if you do not even want to try";
        debug(errMsg);
        debug(e.message);
        console.error(styleText("gray", errMsg));
    }

    // Kill CodeNarc server.
    async killCodeNarcServer() {
        // Try by process first as it's more reliable.
        let outputString = this.killCodeNarcProcess();
        if (outputString) {
            return outputString;
        }

        // Process kill wasn't possible, so try sending a kill http request.
        // The /kill endpoint requires the token the server persisted at startup: without it, any
        // local process could shut the server down through the loopback (nvuillam/npm-groovy-lint#607).
        const killUri = this.getCodeNarcServerUri() + "/kill";
        const killToken = this.readKillToken();
        try {
            const response = await fetch(killUri, {
                method: "POST",
                headers: killToken ? { "X-CodeNarc-Kill-Token": killToken } : {},
                signal: AbortSignal.timeout(10000),
            });
            // Do not swallow body read errors: the server can reset the connection while replying,
            // and the catch block below correctly classifies that as a successful termination
            const responseText = await response.text();
            let responseData;
            try {
                responseData = JSON.parse(responseText);
            } catch {
                // Something answered on this port, but it is not a CodeNarcServer: reporting it as
                // "not running" would be wrong, the kill request was answered by another service
                responseData = {};
            }
            if (responseData.status === "killed") {
                outputString = "CodeNarcServer terminated";
            } else if (responseData.status === "unauthorized") {
                // The running server did not accept our token: it was started with another token
                // file (custom tmpdir, another user). It stays up, so do not wait for it to stop.
                outputString = "Error killing CodeNarcServer: kill token not found or not accepted";
            } else {
                outputString = "Error killing CodeNarcServer";
            }
        } catch (e) {
            // The server can shut itself down before replying, resetting the connection
            if (["ECONNRESET", "UND_ERR_SOCKET"].includes(getErrorCode(e)) || e.message.includes("socket hang up")) {
                outputString = "CodeNarcServer terminated";
            } else {
                // This should be ECONNREFUSED.
                debug(`CodeNarcServer kill request failed: ${e}`);
                outputString = `CodeNarcServer was not running`;
            }
        }

        // Only an accepted kill leaves a server to wait for: after a refused kill (bad token,
        // foreign service on the port) or when nothing was running, the wait would just burn
        // its full timeout pinging something that will never stop.
        if (outputString !== "CodeNarcServer terminated") {
            trace(`killCodeNarcServer: ${outputString}`);
            return outputString;
        }

        // Wait for the server to stop otherwise when we try to start it
        // again it it's likely to fail due to an port in use error.
        const serverPingUri = this.getCodeNarcServerUri() + "/ping";

        const maxWaitStopMs = 10000;
        const startWaitStop = performance.now();
        // Each ping is chained from the previous one's settlement rather than fired on a fixed interval:
        // against a server that accepts connections but never answers, a timer would pile up overlapping
        // requests. The controller aborts whatever is still in flight when we give up.
        const pingController = new AbortController();
        await new Promise((resolve) => {
            let done = false;
            const stopWaiting = () => {
                if (done) {
                    return;
                }
                done = true;
                pingController.abort();
                resolve();
            };
            const pingOnce = () => {
                if (done) {
                    return;
                }
                debug(`pinging CodeNarcServer at ${serverPingUri} serverStatus: ${this.serverStatus}`);
                // Give up after the deadline: a foreign service happily answering 200 on this port would
                // otherwise keep the loop, and so --killserver, running forever
                if (performance.now() - startWaitStop > maxWaitStopMs) {
                    debug(`Gave up waiting for CodeNarcServer to stop after ${maxWaitStopMs}ms`);
                    stopWaiting();
                    return;
                }
                fetch(serverPingUri, { signal: AbortSignal.any([pingController.signal, AbortSignal.timeout(5000)]) })
                    .then((response) => {
                        // Ping bodies are never used: discard them so the connection is released right away
                        response.body?.cancel().catch(() => {});
                        debug(`ping response: ${response.status}`);
                        if (!response.ok) {
                            // Whatever is answering on this port is not a healthy CodeNarcServer: stop waiting
                            stopWaiting();
                        } else {
                            setTimeout(pingOnce, 400);
                        }
                    })
                    .catch((e) => {
                        debug(`Ping code: ${getErrorCode(e)} message: ${e.message}`);
                        stopWaiting();
                    });
            };
            setTimeout(pingOnce, 400);
        });

        trace(`killCodeNarcServer: ${outputString}`);

        return outputString;
    }

    // Path of the file where the server persists the /kill authorization token (restricted to
    // the current OS user). Computed from os.tmpdir() and passed to the server at startup with
    // --tokenfile, so client and server agree on the location even where Java's java.io.tmpdir
    // diverges from os.tmpdir() (e.g. Linux with TMPDIR set, which the JVM ignores).
    getKillTokenFilePath() {
        const serverOptions = optionsDefinition.parse({});
        const port = this.options.serverport || serverOptions.serverport;
        return path.join(os.tmpdir(), `npm-groovy-lint-server-kill-${port}.token`);
    }

    // Read the kill token persisted by the running server. Returns null when unavailable (no
    // server started yet, server started manually with another tmpdir, or an old server
    // predating the token mechanism - which accepts token-less kills anyway).
    readKillToken() {
        try {
            const token = fs.readFileSync(this.getKillTokenFilePath(), "utf8").trim();
            return token || null;
        } catch {
            return null;
        }
    }

    // Return CodeNarc server URI
    getCodeNarcServerUri() {
        // If use of --codenarcargs, get default values for CodeNarcServer host & port
        const serverOptions = optionsDefinition.parse({});
        // The Java server only listens on the IPv4 loopback, which is why the serverhost default is
        // http://127.0.0.1 rather than http://localhost (that resolves to ::1 first on some hosts).
        // An explicitly provided serverhost is used as-is: the caller may be pointing at a tunnel.
        const host = this.options.serverhost || serverOptions.serverhost;
        return host + ":" + (this.options.serverport || serverOptions.serverport);
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
