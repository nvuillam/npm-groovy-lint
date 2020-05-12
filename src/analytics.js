const analyticsLib = require("analytics").default;
const segmentPlugin = require("@analytics/segment");
const debug = require("debug")("npm-groovy-lint");
const os = require("os");

const SEGMENT_ID = "hjdIe83s5rbwgDfOWLxq3BkvXqQVEDTz";
let analyticsInstance;

// Record anonymous statistics for better use. Returns a promise that can be awaited by the caller or not
function recordAnonymousEvent(eventType, data) {
    debug("Analytics init: " + eventType);
    return new Promise(resolve => {
        const analytics = getAnalyticsInstance(eventType);
        const eventPayloadFiltered = buildEventPayload(data);
        analytics.track(eventType, eventPayloadFiltered).then(() => {
            debug("Analytics sent: " + eventType + " " + JSON.stringify(eventPayloadFiltered));
            resolve();
        });
    });
}

function buildEventPayload(data) {
    const payloadFiltered = {
        osPlatform: os.platform(),
        osRelease: os.release()
    };
    // Status
    if (data.status) {
        payloadFiltered.status = data.status;
    }
    // Elapsed time
    if (data.elapsed) {
        payloadFiltered.elapsedTimeMs = data.elapsed;
    }
    // Options
    if (data.options) {
        if (data.options.rules) {
            payloadFiltered.rules = data.options.rules;
        }
        if (data.options.path) {
            payloadFiltered.optionPath = data.options.path;
        }
        if (data.options.files) {
            payloadFiltered.optionFiles = data.options.files.replace(/\*/g, "#");
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
    // Counters
    if (data.summary) {
        if (data.summary.totalFoundNumber) {
            payloadFiltered.totalFoundNumber = data.summary.totalFoundNumber;
        }
        if (data.options && [data.options.format, data.options.fix].includes(true) && data.summary.totalFixedNumber) {
            payloadFiltered.totalFixedNumber = data.summary.totalFixedNumber;
        }
        if (data.options && [data.options.format, data.options.fix].includes(true) && data.summary.totalRemainingNumber) {
            payloadFiltered.totalRemainingNumber = data.summary.totalRemainingNumber;
        }
    }
    return payloadFiltered;
}

function getAnalyticsInstance(eventType) {
    if (analyticsInstance == null) {
        const pkgJson = getPackageJson();
        analyticsInstance = analyticsLib({
            app: pkgJson.name,
            version: pkgJson.version,
            plugins: [
                segmentPlugin({
                    writeKey: SEGMENT_ID,
                    flushInterval: eventType.startsWith("cli") ? 1 : 10000
                })
                // GA disabled because npm analytics does not manage custom dimensions for node apps
                /*    googleAnalytics({
                        trackingId: GA_ID,
                        anonymizeIp: true,
                        customDimensions: {
                            // Strings
                            rules: "dimension1",
                            status: "dimension2",
                            optionPath: "dimension3",
                            optionFiles: "dimension4",
                            optionParse: "dimension5",
                            optionOutput: "dimension6",
                            optionFailOn: "dimension7",
                            optionCodeNarcArgs: "dimension8",
                            optionIgnorePattern: "dimension9",
                            optionConfig: "dimension10",
                            // Numbers
                            elapsedTimeMs: "metric1",
                            totalFoundNumber: "metric2",
                            totalFixedNumber: "metric3",
                            totalRemainingNumber: "metric4"
                        }
                    })  */
            ]
        });
    }
    return analyticsInstance;
}

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

module.exports = { recordAnonymousEvent };
