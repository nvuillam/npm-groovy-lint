"use strict";

// Imports
const util = require("util");
const exec = util.promisify(require("child_process").exec);

// Config
const jDeployRootPath = process.env.JDEPLOY_ROOT_PATH || __dirname ;

// Process
async function run() {
    let userArgs = process.argv.slice(2);

    // Remove -report userArg if existing, and add XML type
    if (userArgs.includes("--ngl-console")) {
        userArgs = userArgs.filter(userArg => !userArg.includes("-report="));
        userArgs.push("-report=console:xml");
    }

    // Build command
    const jDeployCommand = '"' + process.argv[0] + '" "'+jDeployRootPath.trim()+'/jdeploy.js" ' + userArgs.join(" ");
    console.debug(jDeployCommand);

    // Run jdeploy as child process
    console.info("NGL: Running CodeNarc with arguments " + userArgs.join(" "));
    const { stdout, stderr } = await exec(jDeployCommand);

    if (stderr && stderr !== "Picked up _JAVA_OPTIONS: -Xmx512M\n") {
        console.error("NGL: Error running CodeNarc: \n" + stderr);
        process.exit(1);
    } else {
        console.log("NGL: Successfully processed CodeNarc: \n" + stdout);
    }
    process.exit(0);
}

run();
