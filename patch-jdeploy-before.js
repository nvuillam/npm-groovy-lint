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

// Copy files into dist folder
fse.copyFileSync('src/index.js', 'dist/index.js');
console.info('NGL: Copied src/index.js into dist folder');

fse.copyFileSync('src/groovy-lint.js', 'dist/groovy-lint.js');
console.info('NGL: Copied groovy-lint-fix.js.js into dist folder');

fse.copyFileSync('src/groovy-lint-fix.js', 'dist/groovy-lint-fix.js');
console.info('NGL: Copied groovy-lint-fix.js into dist folder');

fse.copyFileSync('src/groovy-lint-rules.js', 'dist/groovy-lint-rules.js');
console.info('NGL: Copied src/groovy-lint-rules.js into dist folder');

fse.copySync('lib', 'dist/lib');
console.info('NGL: Copied lib files into dist/lib');

fse.copy

process.exit(0);

