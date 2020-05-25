#! /usr/bin/env node
// Copy source files into vscode npm installation (avoid generate betas to test updates)
// npm-groovy-lint & vscode-groovy-lint must be in the same folder, else you have to override  VSCODE_GROOVY_LINT_PATH env variable

"use strict";

// Imports
const { existsSync, emptyDirSync, mkdirSync, copySync } = require('fs-extra');

console.log('---- START DEPLOY IN VSCODE INSTALLED npm-groovy-lint PACKAGE ----');

const vsCodeGroovyLintPath = process.env.VSCODE_GROOVY_LINT_PATH || './../vscode-groovy-lint';

const targetPath = `${vsCodeGroovyLintPath}/server/node_modules/npm-groovy-lint/lib`;

console.info(`GroovyLint: Starting copying package in vscode for testing`);

// Reset target folder
if (existsSync(targetPath)) {
    emptyDirSync(targetPath);
}
else {
    mkdirSync(targetPath);
}

// Copy files into dist folder (copied from lib folder)
copySync('./lib', targetPath);
console.info(`GroovyLint: Copied ./lib files into ${targetPath}`);

console.log('---- END DEPLOY IN VSCODE INSTALLED npm-groovy-lint PACKAGE ----\n');

process.exit(0);

