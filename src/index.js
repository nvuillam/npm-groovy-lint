#! /usr/bin/env node

const NpmGroovyLint = require("./groovy-lint.js");

const linter = new NpmGroovyLint({}, process.argv);
linter.run();
