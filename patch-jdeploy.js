"use strict"
// Imports
const fse = require('fs-extra');

// Config
const jdeployFile = './jdeploy-bundle/jdeploy.js';
const packageJsonFile = 'package.json';

console.info('npm-groovy-lint: Patching ' + jdeployFile + '...');

const packageJsonConfig = fse.readJsonSync(packageJsonFile);

const jarFileName = packageJsonConfig.jdeploy.jar.slice(packageJsonConfig.jdeploy.jar.lastIndexOf('/') + 1);

const replacements = [
    { before: ('"' + jarFileName + '"'), after: '"{{JAR_NAME}}"' },
    { before: '{{MAIN_CLASS}}', after: packageJsonConfig.jdeploy.mainClass },
    { before: '{{CLASSPATH}}', after: (jarFileName + ':' + packageJsonConfig.jdeploy.classPath) },
];

console.debug('Replacements: ' + JSON.stringify(replacements, null, 2));

let jdeployFileContent = fse.readFileSync(jdeployFile).toString();

for (const replacement of replacements) {
    jdeployFileContent = jdeployFileContent.replace(replacement.before, replacement.after);
}

fse.writeFileSync(jdeployFile, jdeployFileContent);

console.info('npm-groovy-lint: ' + jdeployFile + ' has been updated.');

