#! /usr/bin/env node
"use strict";

// Error message if Node version < 12
const NODE_MAJOR_VERSION = process.versions.node.split(".")[0];
if (NODE_MAJOR_VERSION < 12) {
    throw new Error("npm-groovy-lint requires Node 12 (or higher)");
}

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
