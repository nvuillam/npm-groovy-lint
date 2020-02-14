"use strict";

// Imports
const util = require("util");
const fse = require("fs-extra");
const os = require("os");
const exec = util.promisify(require("child_process").exec);
const xml2js = require("xml2js");

// Config
const jDeployRootPath = process.env.JDEPLOY_ROOT_PATH || __dirname;
const tempXmlFile = os.tmpdir() + "/CodeNarcReportXml_" + Math.random() + ".xml";

// Process
async function run() {
    let userArgs = process.argv.slice(2);

    let reformat = null;

    // Remove -report userArg if existing, and add XML type
    if (userArgs.includes("--ngl-console")) {
        userArgs = userArgs.filter(userArg => !userArg.includes("-report=") && userArg != "--ngl-console");
        userArgs.push("-report=xml:" + tempXmlFile);
        reformat = "ngl-console";
    }

    // Build command
    const jDeployCommand = '"' + process.argv[0] + '" "' + jDeployRootPath.trim() + '/jdeploy.js" ' + userArgs.join(" ");
    console.debug(jDeployCommand);

    // Run jdeploy as child process
    console.info("NGL: Running CodeNarc with arguments " + userArgs.join(" "));
    const { stdout, stderr } = await exec(jDeployCommand);

    if (stderr && stderr !== "Picked up _JAVA_OPTIONS: -Xmx512M\n") {
        console.error("NGL: Error running CodeNarc: \n" + stderr);
        process.exit(1);
    } else {
        if (reformat == null) {
            console.log("NGL: Successfully processed CodeNarc: \n" + stdout);
        } else {
            await reformatOutput(reformat);
        }
    }
    process.exit(0);
}

// Reformat output if requested in command line
async function reformatOutput(reformat) {
    if (reformat === "ngl-console") {
        const parser = new xml2js.Parser();
        const tempXmlFileContent = await parser.parseStringPromise(fse.readFileSync(tempXmlFile), { attrkey: "nglbase" });
        const files = {};
        for (const fileInfo of tempXmlFileContent.CodeNarc.Package[0].File) {
            const fileNm = fileInfo["$"].name;
            if (files[fileNm] == null) {
                files[fileNm] = { errors: [] };
            }
            for (const violation of fileInfo.Violation) {
                const err = {
                    line: violation["$"].lineNumber,
                    rule: violation["$"].ruleName,
                    severity:
                        violation["$"].priority == "1"
                            ? "error"
                            : violation["$"].priority == "2"
                            ? "warning"
                            : violation["$"].priority == "3"
                            ? "warning"
                            : "unknown",
                    msg: violation.Message[0]
                };
                files[fileNm].errors.push(err);
            }

            // Display as console log
            for (const fileNm of Object.keys(files)) {
                const fileErrors = files[fileNm].errors;
                console.log(fileNm);
                for (const err of fileErrors) {
                    console.log("  " + err.line + "  " + err.severity + "  " + err.rule + "  " + err.msg);
                }
                console.log("");
            }
            fse.removeSync(tempXmlFile);
        }
    }
}

run();
