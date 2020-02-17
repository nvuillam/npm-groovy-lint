#! /usr/bin/env node
// Update jdeploy.js with correct arguments to call CodeNarc without calling a jar
"use strict";

// Imports
const fse = require('fs-extra');

// Config
const jdeployFile = './jdeploy-bundle/jdeploy.js';
const runGroovyLintFile = './jdeploy-bundle/index.js';
const jdeployFileAfterRename = './jdeploy-bundle/originaljdeploy.js';
const packageJsonFile = 'package.json';

// Process

console.info('NGL: Patching ' + jdeployFile + '...');
const packageJsonConfig = fse.readJsonSync(packageJsonFile);

const jarFileNamePath = packageJsonConfig.jdeploy.jar.slice(packageJsonConfig.jdeploy.jar.indexOf('/') + 1);
const jarFileName = packageJsonConfig.jdeploy.jar.slice(packageJsonConfig.jdeploy.jar.lastIndexOf('/') + 1);

const replacements = [
    { before: ('"' + jarFileName + '"'), after: '"{{JAR_NAME}}"' },
    { before: '{{MAIN_CLASS}}', after: packageJsonConfig.jdeploy.mainClass },
    { before: '{{CLASSPATH}}', after: (jarFileNamePath + ':' + packageJsonConfig.jdeploy.classPath) },
];

console.debug('Replacements: ' + JSON.stringify(replacements, null, 2));

let jdeployFileContent = fse.readFileSync(jdeployFile).toString();

for (const replacement of replacements) {
    jdeployFileContent = jdeployFileContent.replace(replacement.before, replacement.after);
}

fse.writeFileSync(jdeployFile, jdeployFileContent);
console.info('NGL: ' + jdeployFile + ' has been updated.');

// Rename jdeploy.js into jdeployOriginal.js
fse.renameSync(jdeployFile, jdeployFileAfterRename);
console.info('NGL: ' + jdeployFile + ' renamed into ' + jdeployFileAfterRename);
// Rename index.js into jdeploy.js
fse.renameSync(runGroovyLintFile, jdeployFile);
console.info('NGL: ' + runGroovyLintFile + ' renamed into ' + jdeployFile);





