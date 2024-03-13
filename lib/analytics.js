const Amplitude = require("amplitude");
const crypto = require("crypto");
const debug = require("debug")("npm-groovy-lint");
const fse = require("fs-extra");
const os = require("os");
const path = require("path");
const { getSourceLines } = require("./utils");

const AMPLITUDE_TOKEN = "2e52ce300e4bd3a76e97e27fe1bf31ad";
const STATS_VERSION = globalThis.NPM_GROOVY_LINT_TEST === true ? -1 : 2;

let amplitudeClient;
let pkgJson;
let anonymousUserId;

// Record anonymous statistics for better use. Returns a promise that can be awaited by the caller or not
async function recordAnonymousEvent(eventType, data) {
    debug("Analytics init: " + eventType);
    if (amplitudeClient == null) {
        amplitudeClient = new Amplitude(AMPLITUDE_TOKEN);
    }
    if (pkgJson == null) {
        pkgJson = getPackageJson();
    }
    if (anonymousUserId == null) {
        anonymousUserId = getUuidV4();
    }
    const events = [];
    const linterEvent = buildLinterEvent(eventType, data);
    events.push(linterEvent);
    events.push(...(await buildFileStatsEvents(linterEvent, data)));
    try {
        return (async resolve => {
            // Failing to send analytics isn't fatal.
            try {
                await amplitudeClient.track(events);
                debug(`Analytics sent type: ${eventType} ${JSON.stringify(events)}`);
            } catch (err) {
                debug(`Analytics send failed type: ${eventType} ${JSON.stringify(events)} ${err}`);
            } finally {
                resolve();
            }
        })();
    } catch (e) {
        debug(`Analytics send failed type: ${eventType} ${JSON.stringify(events)} ${e}`);
        return Promise.resolve();
    }
}

// Build payload for main linter event
function buildLinterEvent(eventType, data) {
    const payloadFiltered = {
        app: pkgJson.name,
        appVersion: pkgJson.version,
        osPlatform: os.platform(),
        osRelease: os.release(),
        ci: process.env.CI ? true : false,
        statsVersion: STATS_VERSION
    };
    // Status
    if (data.status || data.status === 0) {
        payloadFiltered.status = data.status === 0 ? 69 : data.status;
    }
    // Error
    if (data.error) {
        payloadFiltered.error = data.error;
    }
    // Elapsed time
    if (data.elapsed) {
        payloadFiltered.elapsedTimeMs = data.elapsed;
    }
    // Options
    if (data.options) {
        if (data.options.rulesets) {
            payloadFiltered.rulesets = data.options.rulesets;
        }
        if (data.options.overriddenRules) {
            payloadFiltered.overriddenRules = data.options.overriddenRules;
        }
        if (data.options.path) {
            payloadFiltered.optionPath = data.options.path;
        }
        if (data.options.files) {
            payloadFiltered.optionFiles = data.options.files.replace(/\*/g, "#");
        } else if (data.options.sourcefilepath) {
            payloadFiltered.optionFiles = data.options.sourcefilepath;
        }
        if (data.options.parse) {
            payloadFiltered.optionParse = data.options.parse;
        }
        if (data.options.output) {
            payloadFiltered.optionOutput = data.options.output;
        }
        if (data.options.failonerror || data.options.failonwarning || data.options.failoninfo) {
            payloadFiltered.optionFailOn = data.options.failonerror ? "error" : data.options.failonwarning ? "warning" : "info";
        }
        if (data.options.codenarcargs) {
            payloadFiltered.optionCodeNarcArgs = data.options.codenarcargs;
        }
        if (data.options.ignorepattern) {
            payloadFiltered.optionIgnorePattern = data.options.ignorepattern;
        }
        if (data.options.config) {
            payloadFiltered.optionConfig = data.options.config;
        }
    }

    // *Summary
    if (data.result && data.result.summary) {
        // Counters
        if (data.result.summary.totalFoundNumber) {
            payloadFiltered.totalFoundNumber = data.result.summary.totalFoundNumber;
        }
        if (data.options && [data.options.format, data.options.fix].includes(true) && data.result.summary.totalFixedNumber) {
            payloadFiltered.totalFixedNumber = data.result.summary.totalFixedNumber;
        }
        if (data.options && [data.options.format, data.options.fix].includes(true) && data.result.summary.totalRemainingNumber) {
            payloadFiltered.totalRemainingNumber = data.result.summary.totalRemainingNumber;
        }
        // Stats of rules
        if (data.result.summary.detectedRules) {
            payloadFiltered.detectedRules = data.result.summary.detectedRules;
        }
        if (data.result.summary.fixedRules) {
            payloadFiltered.fixedRules = data.result.summary.fixedRules;
        }
        // Number of lines of the first linted file
        if (data.result.linesNumber) {
            payloadFiltered.fileLinesNumber = data.result.linesNumber;
        }
    }

    const linterEvent = {
        app_version: payloadFiltered.appVersion,
        os_name: payloadFiltered.osPlatform,
        os_version: payloadFiltered.osRelease,
        language: process.env.LANG || process.env.LANGUAGE || process.env.LC_ALL || process.env.LC_MESSAGES,
        event_type: eventType,
        event_properties: payloadFiltered,
        user_id: anonymousUserId,
        ip: "127.0.0.1"
    };

    return linterEvent;
}

// Retrieve npm-groovy-lint package.json
function getPackageJson() {
    const FindPackageJson = require("find-package-json");
    const finder = FindPackageJson(__dirname);
    const packageJsonFileNm = finder.next().filename;
    let pkg;
    if (packageJsonFileNm) {
        pkg = require(packageJsonFileNm);
    } else {
        pkg = { name: "npm-groovy-lint", version: "0.0.0" };
        console.warn(`package.json not found, use default value ${JSON.stringify(pkg)} instead`);
    }
    return pkg;
}

// Get unique anonymous user identifier
function getUuidV4() {
    if (globalThis.anonymousUserId) {
        return globalThis.anonymousUserId;
    }
    const localStorageFileNm = path.resolve(os.homedir() + "/.node-stats/local-storage.json");
    let usrLocalStorage = {};
    if (fse.existsSync(localStorageFileNm)) {
        usrLocalStorage = fse.readJsonSync(localStorageFileNm);
    }
    if (usrLocalStorage.anonymousUserId) {
        return usrLocalStorage.anonymousUserId;
    }
    const { v4: uuidv4 } = require("uuid");
    const anonUsrId = uuidv4();
    usrLocalStorage.anonymousUserId = anonUsrId;
    globalThis.anonymousUserId = usrLocalStorage.anonymousUserId;
    try {
        fse.ensureDirSync(path.resolve(os.homedir() + "/.node-stats"), { mode: "0777" });
        fse.writeJsonSync(localStorageFileNm, usrLocalStorage);
    } catch (e) {
        debug(`Unable to write anonymous user id in ${localStorageFileNm}
${e.message}`);
    }
    return usrLocalStorage.anonymousUserId;
}

// Build event related to framework usage in files
async function buildFileStatsEvents(linterEvent, data) {
    const fileStatsEvents = [];
    if (data.fileList) {
        for (const file of data.fileList) {
            const fileStatEvent = Object.assign({}, linterEvent);
            fileStatEvent.event_type = "file-stat";
            fileStatEvent.event_properties = await getFileStats(file);
            fileStatsEvents.push(fileStatEvent);
        }
    }
    return fileStatsEvents;
}

async function getFileStats(file) {
    const fileStatEventProps = {};
    const source = await fse.readFile(file).catch(err => {
        throw new Error(`Unable to read stats: ${err}`); // Ensure that we have a stack trace.
    });
    const sourceLines = await getSourceLines(source);
    fileStatEventProps.fileId = crypto
        .createHash("sha1")
        .update(file)
        .digest("base64");
    fileStatEventProps.fileName = path.basename(file);
    fileStatEventProps.fileExtension = path.extname(fileStatEventProps.fileName);
    fileStatEventProps.linesNumber = sourceLines.length;
    fileStatEventProps.statsVersion = STATS_VERSION;
    const { mainFrameworkKey, frameworkKeys } = listFileUsedFrameworks(file, source);
    fileStatEventProps.frameworks = frameworkKeys;
    if (mainFrameworkKey != null) {
        fileStatEventProps.mainFramework = mainFrameworkKey;
    }
    for (const fwKey of fileStatEventProps.frameworks) {
        fileStatEventProps[`use_${fwKey}`] = true;
    }
    return fileStatEventProps;
}

const frameworkDefs = [
    { name: "beakerx", priority: 3 }, // UNDEFINED
    { name: "codenarc", priority: 5, sourceIncludes: ["codenarc", "groovylint"] },
    { name: "dru", priority: 2, packages: ["com.agorapulse.dru"] },
    { name: "ersatz", priority: 2, packages: ["com.stehno.ersatz"] },
    { name: "gaelyk", priority: 2, packages: ["groovyx.gaelyk"] },
    { name: "gaiden", priority: 3, packages: ["gaiden"] },
    { name: "gpars", priority: 5, packages: ["groovyx.gpars"] },
    { name: "geb", priority: 3, packages: ["geb"] },
    { name: "gperfutils", priority: 5, packages: ["groovyx.gbench", "groovyx.gprof"] },
    { name: "gradle", priority: 1, fileExtensions: [".gradle"] },
    { name: "grails", priority: 1, filePathIncludes: ["grails-app"] },
    { name: "grain", priority: 2, packages: ["com.sysgears"] },
    { name: "grapes", priority: 5, sourceIncludes: ["@Grab"] },
    { name: "griffon", priority: 2, sourceIncludes: ["griffon"] },
    { name: "groocss", priority: 2, packages: ["org.groocss"] },
    { name: "groovyant", priority: 5, packages: ["groovy.ant"] },
    { name: "groovymbean", priority: 5, sourceIncludes: ["GroovyMBean"] },
    { name: "groovysh", priority: 2, sourceIncludes: ["groovysh"] },
    { name: "groovysql", priority: 5, packages: ["groovy.sql"] },
    { name: "groovyswing", priority: 5, packages: ["groovy.swing"] },
    { name: "gru", priority: 2, packages: ["com.agorapulse.gru"] },
    { name: "httpbuilder", priority: 5, packages: ["groovyx.net.http"] },
    { name: "infrastructor", priority: 2, sourceIncludes: ["inlineInventory", "infrastructor"] },
    { name: "jenkinsjobdsl", priority: 5, sourceIncludes: ["job("] },
    { name: "jenkinspipeline", priority: 5, fileNameIncludes: ["Jenkinsfile"], sourceIncludes: ["pipeline {", "pipeline{"] },
    { name: "jenkinssharedlib", priority: 5, sourceIncludes: ["@NonCPS"] },
    { name: "jenkins", priority: 1, frameworksUsesIncludes: ["jenkinsjobdsl", "jenkinspipeline", "jenkinssharedlib"] },
    { name: "jirascriptrunner", priority: 2, packages: ["com.atlassian.jira"] },
    { name: "jmeter", priority: 2, packages: ["org.apache.jmeter"] },
    { name: "katalon", priority: 2, packages: ["com.kms.katalon"] },
    { name: "kisswebframework", priority: 2 }, // UNDEFINED
    { name: "micronaut", priority: 2, packages: ["io.micronaut"] },
    { name: "nextflow", priority: 1, fileExtensions: [".nf"], sourceIncludes: ["#!/usr/bin/env nextflow"] },
    { name: "picocli", priority: 2, packages: ["picocli"] },
    { name: "ratpack", priority: 2, packages: ["ratpack"] },
    { name: "restassured", priority: 3 }, // UNDEFINED
    { name: "soapui", priority: 3 }, // UNDEFINED
    { name: "spock", priority: 3, packages: ["spock"] },
    { name: "spreadsheetbuilder", priority: 2, packages: ["org.modelcatalogue.spreadsheet"] },
    { name: "springboot", priority: 1, sourceIncludes: ["@SpringBootApplication"] },
    { name: "springcloudcontract", priority: 2, sourceIncludes: ["org.springframework.cloud.spec.Contract"] },
    { name: "sshoogr", priority: 2, packages: ["com.aestasit.infrastructure"] },
    { name: "vertx", priority: 3 } // UNDEFINED
];

function listFileUsedFrameworks(file, source) {
    const frameworksUsed = [];
    const unorderedFrameworkKeys = [];
    const fileBaseName = path.basename(file);
    const fileExtname = path.extname(file);
    for (const frameworkDef of frameworkDefs) {
        if (isUsedFramework(frameworkDef, file, source, fileExtname, fileBaseName, unorderedFrameworkKeys)) {
            frameworksUsed.push(frameworkDef);
            unorderedFrameworkKeys.push(frameworkDef.name);
        }
    }
    // Sort by priority
    frameworksUsed.sort((a, b) => a.priority - b.priority);
    // Calculate main framework
    let mainFrameworkKey = null;
    const validMainFrameworks = frameworksUsed.filter(frameworkDef => frameworkDef.priority <= 3);
    if (validMainFrameworks[0]) {
        mainFrameworkKey = validMainFrameworks[0].name;
    }
    // Only return keys
    const frameworkKeys = frameworksUsed.map(frameworkDef => frameworkDef.name);
    return { mainFrameworkKey, frameworkKeys };
}

function isUsedFramework(frameworkDef, file, source, fileExtname, fileBaseName, frameworksUsed) {
    // Check file extension
    if (frameworkDef.fileExtensions) {
        for (const ext of frameworkDef.fileExtensions) {
            if (fileExtname === ext) {
                return true;
            }
        }
    }
    // Check if another framework has been detected
    if (frameworkDef.frameworksUsesIncludes) {
        for (const fwKey of frameworkDef.frameworksUsesIncludes) {
            if (frameworksUsed.includes(fwKey)) {
                return true;
            }
        }
    }

    // Check use of package
    if (frameworkDef.packages) {
        for (const pckg of frameworkDef.packages) {
            if (source.includes(`${pckg}.`)) {
                return true;
            }
        }
    }
    // Check presence in sources
    if (frameworkDef.sourceIncludes) {
        for (const text of frameworkDef.sourceIncludes) {
            if (source.includes(text)) {
                return true;
            }
        }
    }
    // Check file name
    if (frameworkDef.fileNameIncludes) {
        for (const str of frameworkDef.fileNameIncludes) {
            if (fileBaseName.includes(str)) {
                return true;
            }
        }
    }

    // Check file path
    if (frameworkDef.filePathIncludes) {
        for (const str of frameworkDef.filePathIncludes) {
            if (file.includes(str)) {
                return true;
            }
        }
    }

    return false;
}

module.exports = { recordAnonymousEvent };
