#! /usr/bin/env node
const debug = require("debug")("java-caller");
const fse = require("fs-extra");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");
const util = require("util");
const exec = util.promisify(require("child_process").exec);

class JavaCaller {
    "use strict";
    minimumJavaVersion = 1.8;
    maximumJavaVersion;
    rootPath = __dirname;

    jarName;
    classPath;
    mainClass;
    port = "0";
    status = null;

    javaSupportDir;
    embeddedJavaDir;

    constructor(opts) {
        this.jarName = opts.jarName || this.jarName;
        this.classPath = opts.classPath || this.classPath;
        this.mainClass = opts.mainClass || this.mainClass;
        this.port = opts.port || this.port;
        this.minimumJavaVersion = opts.minimumJavaVersion || this.minimumJavaVersion;
        this.maximumJavaVersion = opts.maximumJavaVersion || this.maximumJavaVersion;
        this.rootPath = opts.rootPath || this.rootPath;
        this.javaCallerSupportDir = `${os.homedir() + path.sep}.java-caller`;
    }

    // Initialize, installing java if it is not present
    async initialize() {
        if (globalThis.NPM_JAVA_CALLER_IS_INITIALIZED !== true) {
            this.embeddedJavaDir = await this.getEmbeddedJavaDir();
            await this.manageJavaInstall();
            globalThis.NPM_JAVA_CALLER_IS_INITIALIZED = true;
        }
    }

    // Run java command
    async run(userArguments, runOptions = {}) {
        runOptions.detached = runOptions.detached || false;
        runOptions.waitForErrorMs = runOptions.waitForErrorMs || 500;
        runOptions.cwd = runOptions.cwd || process.cwd();
        await this.addJavaInPath();
        await this.initialize();
        const classPathStr = this.classPath
            .split(":")
            .map(classPathElt => path.resolve(this.rootPath + path.sep + classPathElt))
            .join(path.delimiter);
        const javaArgs = this.buildArguments(classPathStr, userArguments);
        let stdout = "";
        let stderr = "";
        const prom = new Promise(resolve => {
            try {
                // Spawn java command line
                debug(`Java command: java ${javaArgs.join(" ")}`);
                const child = spawn("java", javaArgs, {
                    detached: runOptions.detached,
                    cwd: runOptions.cwd,
                    env: Object.assign({}, process.env),
                    stdio: runOptions.detached ? "ignore" : "pipe",
                    windowsHide: true,
                    windowsVerbatimArguments: true
                });
                // Detach from main process in case detached === true
                if (runOptions.detached) {
                    child.unref();
                } else {
                    // Gather stdout and stderr if not detached sub process
                    child.stdout.on("data", data => {
                        stdout += data;
                    });
                    child.stderr.on("data", data => {
                        stderr += data;
                    });
                }
                child.on("error", data => {
                    this.status = 666;
                    stderr += "Java spawn error: " + data;
                    resolve();
                });
                child.on("close", code => {
                    this.status = code;
                    resolve();
                });
            } catch (e) {
                this.status = 666;
                stderr = `Java spawn fatal error: ${e.message}`;
                resolve();
            }
        });

        if (runOptions.detached) {
            // Detached mode: Just wait a little amount of time in case you want to check a command error
            await new Promise(resolve =>
                setTimeout(() => {
                    resolve();
                }, runOptions.waitForErrorMs)
            );
        } else {
            // Not detached mode: wait for Promise to be resolved
            await prom;
        }

        return {
            status: this.status,
            stdout: stdout,
            stderr: stderr
        };
    }

    // Set first java arguments, then jar || classpath, then jar/class user arguments
    buildArguments(classPathStr, userArgs) {
        let javaArgs = [];
        let programArgs = [];
        for (const arg of userArgs) {
            if (arg.startsWith("-D") || arg.startsWith("-X")) {
                javaArgs.push(arg);
            } else {
                programArgs.push(arg);
            }
        }
        let allArgs = [];
        allArgs.push(...javaArgs);
        if (this.jarName) {
            allArgs.push(...["-jar", `${this.rootPath}/${this.jarName}`]);
        } else {
            allArgs.push(...["-cp", `${classPathStr}`, this.mainClass]);
        }
        allArgs.push(...programArgs);
        return allArgs;
    }

    // Add embedded java dir in PATH or JAVA_HOME
    async addJavaInPath() {
        const pathBefore = process.env["PATH"];
        this.embeddedJavaDir = await this.getEmbeddedJavaDir();
        // Use java-caller downloaded java
        if (await fse.exists(this.embeddedJavaDir)) {
            process.env["PATH"] = process.env["PATH"].includes(this.embeddedJavaDir)
                ? process.env["PATH"]
                : this.embeddedJavaDir + path.delimiter + process.env["PATH"];
        }
        // If java home is set, but not jdk or jre, add it in PATH
        else if (process.env["JAVA_HOME"] && !process.env["PATH"].includes("jdk") && !process.env["PATH"].includes("jre")) {
            process.env["PATH"] = process.env["PATH"].includes(process.env["JAVA_HOME"])
                ? process.env["PATH"]
                : `${process.env["JAVA_HOME"] + path.sep}bin${path.delimiter}${process.env["PATH"]}`;
        }
        if (pathBefore !== process.env["PATH"]) {
            debug("New PATH value: " + process.env["PATH"]);
        }
    }

    // Install node-jre if the found java version is not matching the requirements
    async manageJavaInstall() {
        const javaVersion = await this.getJavaVersion();
        if (
            javaVersion === false ||
            javaVersion < this.minimumJavaVersion ||
            (this.maximumJavaVersion && javaVersion > this.maximumJavaVersion) ||
            process.env["JAVA_CALLER_USE_NODE_JRE"]
        ) {
            // Create a directory for installing node-jre and ensure it contains a dummy package.json
            await fse.ensureDir(this.javaCallerSupportDir, { mode: "0777" });
            const packageJson = `${this.javaCallerSupportDir + path.sep}package.json`;
            if (!(await fse.exists(packageJson))) {
                await fse.writeFile(packageJson, JSON.stringify({ name: "java-caller-support", version: "1.0.0" }), "utf8");
            }
            // Install node-jre if necessary
            if (!(await fse.exists(this.embeddedJavaDir))) {
                console.log(
                    `Java between ${this.minimumJavaVersion} and ${this.maximumJavaVersion} is required  ${
                        javaVersion ? "(" + javaVersion + " found)" : ""
                    }`
                );
                console.log(`Installing/Updating JRE in ${this.javaCallerSupportDir}...`);
                const { stdout, stderr } = await exec("npm install node-jre --save", { cwd: this.javaCallerSupportDir });
                this.embeddedJavaDir = await this.getEmbeddedJavaDir(true);
                console.log(`Installed/Updated JRE in ${this.embeddedJavaDir}\nstdout: ${stdout}\nstderr: ${stderr}`);
            }
            // Update environment
            await this.addJavaInPath();
            const installedVersion = await this.getJavaVersion();
            console.log(`Using Java version ${installedVersion}`);
        }
    }

    async getJavaVersion() {
        try {
            const { stderr } = await exec("java -version");
            const match = /version "(.*?)"/.exec(stderr);
            const parts = match[1].split(".");
            let join = ".";
            let versionStr = "";
            for (const v of parts) {
                versionStr += v;
                if (join !== null) {
                    versionStr += join;
                    join = null;
                }
            }
            versionStr = versionStr.replace("_", "");
            const versionNb = parseFloat(versionStr);
            debug(`Found Java version ${versionNb}`);
            return versionNb;
        } catch (e) {
            debug(`Java not found: ${e.message}`);
            return false;
        }
    }

    fail(reason) {
        console.error(reason);
        this.status = 666;
    }

    async getEmbeddedJavaDir(force = false) {
        if ((this.embeddedJavaDir || globalThis.NPM_JAVA_CALLER_EMBEDDED_JAVA_DIR) && force === false) {
            this.embeddedJavaDir = this.embeddedJavaDir || globalThis.NPM_JAVA_CALLER_EMBEDDED_JAVA_DIR;
            return this.embeddedJavaDir;
        }
        let _platform = os.platform();
        let _driver;
        switch (_platform) {
            case "darwin":
                _platform = "macosx";
                _driver = `Contents${path.sep}Home${path.sep}bin`;
                break;
            case "win32":
                _platform = "windows";
                _driver = "bin";
                break;
            case "linux":
                _driver = "bin";
                break;
            default:
                this.fail(`unsupported platform: ${_platform}`);
        }
        let jreDir = `${this.javaCallerSupportDir + path.sep}node_modules${path.sep}node-jre${path.sep}jre`;
        try {
            const dirContent = await fse.readdir(jreDir);
            const dirContentFiltered = dirContent.filter(file => fse.statSync(path.join(jreDir, file)).isDirectory());
            jreDir = jreDir + path.sep + dirContentFiltered[0] + path.sep + _driver;
            this.embeddedJavaDir = jreDir;
            debug(`Embedded java dir: ${this.embeddedJavaDir}`);
        } catch (e) {
            this.embeddedJavaDir = jreDir;
            debug(`Error while getting embedded java dir ${this.embeddedJavaDir}: ${e.message}`);
        }
        return this.embeddedJavaDir;
    }
}

module.exports = { JavaCaller };
