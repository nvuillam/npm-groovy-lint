#! /usr/bin/env node
"use strict";

const NpmGroovyLint = require("./groovy-lint.js");

// Create linter/formatter/fixer with arguments
const linter = new NpmGroovyLint(process.argv, { origin: "index" });

// Run asynchronously to use the returned status for process.exit
(async () => {
    try {
        await linter.run();
        process.exit(linter.status);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
})();
