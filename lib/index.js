#! /usr/bin/env node
"use strict";

const NpmGroovyLint = require("./groovy-lint.js");

// Create linter/formatter/fixer with arguments
const linter = new NpmGroovyLint(process.argv, { origin: "index" });

// Run asynchronously to use the returned status for process.exit
(async () => {
    try {
        await linter.run();
        process.exitCode = linter.status;
    } catch (err) {
        console.error("Unexpected error: " + err.message + "\n" + err.stack);
        process.exitCode = 1;
    }
})();
