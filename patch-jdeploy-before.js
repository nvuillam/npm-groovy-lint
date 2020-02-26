#! /usr/bin/env node
// Copy required files into jdeploy-bundle after bundle generation
"use strict";

// Imports
const fse = require('fs-extra');
const rimraf = require('rimraf');

// Reset dist folder
if (fse.existsSync('dist')) {
    rimraf.sync("dist");
    fse.mkdirSync('dist');
}
else {
    fse.mkdirSync('dist');
}

// Copy files into dist folder (where they will be taken by "jdeploy install" command and copied to jdeploy_bundle)
const filesToCopy =
    [
        "index.js",
        "groovy-lint.js",
        "groovy-lint-fix.js",
        "groovy-lint-rules.js",
        "options.js",
        "utils.js"
    ];

for (const fileName of filesToCopy) {
    fse.copyFileSync('src/' + fileName, 'dist/' + fileName);
    console.info('NGL: Copied lib files into dist/lib');
}

fse.copySync('lib', 'dist/lib');
console.info('NGL: Copied lib files into dist/lib');

process.exit(0);

