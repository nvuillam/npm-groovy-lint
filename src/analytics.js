const Insight = require("insight");
// const debug = require("debug")("npm-groovy-lint");

const GA_ID = "UA-166052962-1";
let pkg = null;
let insight = null;

// Record anonymous statistics for better use
async function manageRecordAnonymousStats(virtualUrlFragments = null, evt = null, objForLabel = null) {
    await getInsightInstance();

    // Track virtualUrl
    if (virtualUrlFragments) {
        insight.track(...virtualUrlFragments);
        // debug("Telemetry VirtualUrl: " + JSON.stringify(virtualUrlFragments));
    }

    // Track event
    if (evt) {
        const evtToSend = Object.assign(
            {},
            {
                category: evt.category,
                action: evt.action,
                label: evt.label
            }
        );
        if (evtToSend.label == null && objForLabel != null) {
            // Remove source content and CodeNarcServer info if present, so analytics DO NOT receive any sensitive or proprietary information
            const logObj = JSON.parse(JSON.stringify(objForLabel));
            for (const prop of ["source", "rules", "serverhost", "serverport", "_"]) {
                delete logObj[prop];
            }
            evtToSend.label = evt.value ? `${evt.value} :: ${JSON.stringify(logObj)}` : `Options ${JSON.stringify(logObj)}`;
        }
        if (evt.value) {
            evtToSend.value = evt.value;
        }
        insight.trackEvent(evtToSend);
        // debug("Telemetry Event: " + JSON.stringify(evtToSend));
    }
}

async function getInsightInstance() {
    if (insight != null) {
        return insight;
    }
    insight = new Insight({
        // Google Analytics tracking code
        trackingCode: GA_ID,
        pkg: getPackageJson()
    });

    // Ask for permission the first time
    if (insight.optOut === undefined) {
        insight.askPermission();
    }
}

function getPackageJson() {
    if (pkg != null) {
        return pkg;
    }
    const FindPackageJson = require("find-package-json");
    const finder = FindPackageJson(__dirname);
    const packageJsonFileNm = finder.next().filename;
    if (packageJsonFileNm) {
        pkg = require(packageJsonFileNm);
    } else {
        pkg = null;
    }
    return pkg;
}

module.exports = { manageRecordAnonymousStats };
