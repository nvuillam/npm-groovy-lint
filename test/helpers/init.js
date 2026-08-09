#! /usr/bin/env node

console.log("npm run test initialized");
// To see npm-groovy-lint debug logs during tests, set NODE_DEBUG=npm-groovy-lint,npm-groovy-lint-trace
// in your environment BEFORE running mocha: Node reads NODE_DEBUG at process start,
// so util.debuglog loggers cannot be enabled from inside this process.
// Reinitialize java-caller cache
globalThis.NPM_JAVA_CALLER_IS_INITIALIZED = false;
globalThis.NPM_GROOVY_LINT_TEST = true;

// Pre-warm the CodeNarc server before the test run.
// Without this, the first test to lint pays the full JVM cold-start + CodeNarc
// class loading cost mid-run (~15-30s). Doing it once here, in an awaited mocha
// global fixture, means every test reuses an already-warm server over HTTP.
// This is a global setup fixture (https://mochajs.org/#global-setup-fixtures):
// mocha awaits it once before any test, and it runs in the same process so the
// started server stays available for the whole run.
export async function mochaGlobalSetup() {
    try {
        const { default: NpmGroovyLint } = await import("../../lib/groovy-lint.js");
        await new NpmGroovyLint(
            {
                path: "./lib/example/",
                files: "**/SampleFileSmall.groovy",
                insight: false,
                failon: "none",
                output: "none",
            },
            {},
        ).run();
        console.log("npm run test: CodeNarc server pre-warmed");
    } catch (err) {
        // Non-fatal: if pre-warm fails, tests will fall back to starting the server on demand.
        console.warn("npm run test: CodeNarc server pre-warm skipped (" + err.message + ")");
    }
}
