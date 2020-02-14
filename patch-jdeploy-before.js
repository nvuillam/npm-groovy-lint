#! /usr/bin/env node
// Copy required files into jdeploy-bundle after bundle generation
"use strict";

// Imports
const fse = require('fs-extra');

// Process
if (!fse.existsSync('jdeploy-bundle')) {
    fse.mkdirSync('jdeploy-bundle');
}

fse.copyFileSync('src/index.js','dist/index.js');
console.info('NPL: Copied index.js into dist folder');
fse.copyFileSync('src/patch-jdeploy-bin.js','dist/patch-jdeploy-bin.js');
console.info('NPL: Copied patch-jdeploy-bin into dist folder');

process.exit(0);

