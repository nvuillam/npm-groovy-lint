#! /usr/bin/env node

//const NpmGroovyLint = require("../../groovy-lint.js");

console.log("npm run test initialized");
// Activate debug log if we are in debug mode
const debug = typeof v8debug === "object" || /--debug|--inspect|--inspect-brk/.test(process.execArgv.join(" "));
if (debug) {
    require("debug").enable("npm-groovy-lint");
    require("debug").enable("java-caller");
}
// Reinitialize java-caller cache
globalThis.NPM_JAVA_CALLER_IS_INITIALIZED = false;
globalThis.NPM_GROOVY_LINT_TEST = true;
/*
// Kill server if already running
(async () => {
    try {
        await new NpmGroovyLint({
            killserver: true,
            insight: false,
            verbose: true
        }).run();
    } catch (err) {
        console.error("Error while killing running server");
    }
})();
*/
