#! /usr/bin/env node

import NpmGroovyLint from "./groovy-lint.js";
import { pathToFileURL } from "url";

// Create linter/formatter/fixer with arguments
const linter = new NpmGroovyLint(process.argv, { origin: "index" });

// Run asynchronously to use the returned status for process.exit
(async () => {
    try {
        await linter.run();
        process.exitCode = linter.status;
    } catch (err) {
        console.error("Unexpected error: " + err.message + "\n" + err.stack);
        process.exitCode = 2;
        // Quit if called by CLI and not as a module
        if (import.meta.url === pathToFileURL(process.argv[1]).href) {
            process.exit();
        }
    }
})();
