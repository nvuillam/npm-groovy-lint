#! /usr/bin/env node
// Copy source files into vscode npm installation (avoid generate betas to test updates)
// npm-groovy-lint & vscode-groovy-lint must be in the same folder, else you have to override  VSCODE_GROOVY_LINT_PATH env variable

"use strict";

// Imports
const fse = require('fs-extra');

const vsCodeGroovyLintPath = process.env.VSCODE_GROOVY_LINT_PATH || './../vscode-groovy-lint';

const targetPath = `${vsCodeGroovyLintPath}/server/node_modules/npm-groovy-lint/jdeploy-bundle`;

console.info(`GroovyLint: Starting copying package in vscode for testing`);

// Reset target folder
if (fse.existsSync(targetPath)) {
    fse.emptyDirSync(targetPath);
}
else {
    fse.mkdirSync(targetPath);
}

// Copy files into dist folder (copied from jdeploy_bundle)
fse.copySync('./jdeploy-bundle', targetPath);
console.info(`GroovyLint: Copied jdeploy-bundle files into ${targetPath}`);

process.exit(0);

