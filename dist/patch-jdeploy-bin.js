#! /usr/bin/env node
// Patch npm bin commands to replace 'jdeploy.js' to 'index.js' (jdeploy does not generate them correctly )
"use strict";

try {

    // Imports
    const child_process = require('child_process');
    const fse = require('fs-extra');

    // Process
    let npmBinFolder = child_process.execSync('npm config get prefix', {silent:true});
    npmBinFolder = npmBinFolder.toString().replace('\n','');
    console.log('NPL: Updating bin runners in '+npmBinFolder+'...');
    const binFiles = ['npm-groovy-lint','npm-groovy-lint.cmd','npm-groovy-lint.ps1'];
    for (const binFile of binFiles) {
        const fullBinFile = npmBinFolder+'/'+binFile ;
        if (fse.existsSync(fullBinFile)) {
            let binFileContent = fse.readFileSync(fullBinFile).toString();
            binFileContent = binFileContent.replace('jdeploy.js','index.js');
            fse.writeFileSync(fullBinFile, binFileContent);
            console.log(' -NPL: Updated '+fullBinFile);
        }
    }

} catch (e) {
    console.warn('Unable to redirect npm-groovy-lint to node_modules/jdeploy-bundle/index.js. Only CodeNarc OPTIONS will be available');
    console.log(e);
}
process.exit(0);