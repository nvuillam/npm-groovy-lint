#! /usr/bin/env node
// Copy required files into jdeploy-bundle after bundle generation
"use strict";

// Imports
const fse = require('fs-extra');

console.log('---- START PATCH JDEPLOY BEFORE ----');

const targetPath = 'dist';

// Reset dist folder
if (fse.existsSync(targetPath)) {
    fse.emptyDirSync(targetPath);
}
else {
    fse.mkdirSync(targetPath);
}

// Copy files into dist folder (where they will be taken by "jdeploy install" command and copied to jdeploy_bundle)
const filesToCopy =
    [
        "codenarc-caller.js",
        "codenarc-factory.js",
        "config.js",
        "filter.js",
        "groovy-lint.js",
        "groovy-lint-fix.js",
        "groovy-lint-rules.js",
        "index.js",
        "options.js",
        "output.js",
        "utils.js"
    ];

for (const fileName of filesToCopy) {
    const origin = `src/${fileName}`;
    const target = `${targetPath}/${fileName}`;
    fse.copyFileSync(origin, target);
    console.info(`GroovyLint: Copied ${origin} into ${target} `);
}

fse.copySync('.groovylintrc-recommended.json', 'dist/.groovylintrc-recommended.json');
console.info('GroovyLint: Copied .groovylintrc-recommended.json file into dist/.groovylintrc-recommended.json');

fse.copySync('.groovylintrc-all.json', 'dist/.groovylintrc-all.json');
console.info('GroovyLint: Copied .groovylintrc-all.json file into dist/.groovylintrc-all.json');

fse.copySync('.groovylintrc-format.json', 'dist/.groovylintrc-format.json');
console.info('GroovyLint: Copied .groovylintrc-format.json file into dist/.groovylintrc-format.json');

fse.copySync('.groovylintrc-recommended-jenkinsfile.json', 'dist/.groovylintrc-recommended-jenkinsfile.json');
console.info('GroovyLint: Copied .groovylintrc-recommended-jenkinsfile.json file into dist/.groovylintrc-recommended-jenkinsfile.json');

fse.copySync('check-version.js', 'dist/check-version.js');
console.info('GroovyLint: Copied check-version.js file into dist/check-version.js');

fse.copySync('src/rules', 'dist/rules');
console.info('GroovyLint: Copied src/rules files into dist/rules');

fse.copySync('lib', 'dist/lib');
console.info('GroovyLint: Copied lib files into dist/lib');

console.log('---- END PATCH JDEPLOY BEFORE ----\n');

process.exit(0);

