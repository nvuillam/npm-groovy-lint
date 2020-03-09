// Shared functions
"use strict";

const debug = require("debug")("npm-groovy-lint");
const fse = require("fs-extra");
const os = require("os");
const xml2js = require("xml2js");
const { npmGroovyLintRules } = require("./groovy-lint-rules.js");
const { evaluateRange, evaluateVariables, getSourceLines } = require("./utils.js");

////////////////////////////
// Build codenarc options //
////////////////////////////

const notCodeNarcRuleNames = ["Groovy", "Jenkinsfile", "all"];

// Convert NPM-groovy-lint into codeNarc arguments
// Create temporary files if necessary
async function prepareCodeNarcCall(options, jdeployRootPath) {
    const result = { codenarcArgs: [] };

    let cnPath = options.path;
    let cnFiles = options.files;

    // If source option, create a temporary Groovy file
    if (options.source) {
        cnPath = os.tmpdir();
        const tmpFileNm = "codeNarcTmpFile_" + Math.random() + ".groovy";
        result.tmpGroovyFileName = os.tmpdir() + "/" + tmpFileNm;
        cnFiles = "**/" + tmpFileNm;
        await fse.writeFile(result.tmpGroovyFileName, options.source);
        debug(`CREATE GROOVY temp file ${result.tmpGroovyFileName} with input source, as CodeNarc requires physical files`);
    }

    // Define base directory
    const baseBefore = (cnPath !== "." && cnPath.startsWith("/")) || cnPath.includes(":/") || cnPath.includes(":\\") ? "" : process.cwd() + "/";
    result.codeNarcBaseDir = cnPath !== "." ? baseBefore + cnPath.replace(/^"(.*)"$/, "$1") : process.cwd();
    result.codenarcArgs.push('-basedir="' + result.codeNarcBaseDir + '"');

    // Create ruleSet groovy file if necessary
    const tmpRuleSetFileName = await manageCreateRuleSetFile(options);
    if (tmpRuleSetFileName) {
        result.tmpRuleSetFile = tmpRuleSetFileName;
        options.rulesets = tmpRuleSetFileName;
    }

    // Build ruleSet & file CodeNarc arguments
    let defaultFilesPattern = "**/*.groovy,**/Jenkinsfile";
    let ruleSetFile = jdeployRootPath + "/lib/example/RuleSet-Groovy.groovy";
    if (options.rulesets) {
        // Jenkinsfile
        if (options.rulesets === "Jenkinsfile") {
            defaultFilesPattern = "**/Jenkinsfile";
            ruleSetFile = jdeployRootPath + "/lib/example/RuleSet-Jenkinsfile.groovy";
        }
        // Groovy
        else if (options.rulesets === "Groovy") {
            defaultFilesPattern = "**/*.groovy";
            ruleSetFile = jdeployRootPath + "/lib/example/RuleSet-Groovy.groovy";
        }
        // All
        else if (options.rulesets === "all") {
            ruleSetFile = jdeployRootPath + "/lib/example/RuleSet-All.groovy";
        }
        // RuleSet file name
        else {
            ruleSetFile = options.rulesets.replace(/^"(.*)"$/, "$1");
        }
    }
    result.codenarcArgs.push('-rulesetfiles="file:' + ruleSetFile + '"');

    // Matching files pattern(s)
    if (cnFiles) {
        result.codenarcArgs.push('-includes="' + cnFiles.replace(/^"(.*)"$/, "$1") + '"');
    } else {
        // If files not sent, use defaultFilesPattern, guessed from options.rulesets value
        result.codenarcArgs.push('-includes="' + defaultFilesPattern + '"');
    }

    // Output
    result.output = options.output.replace(/^"(.*)"$/, "$1");
    if (["txt", "json", "none"].includes(result.output) || result.output.endsWith(".txt") || result.output.endsWith(".json")) {
        result.outputType = result.output.endsWith(".txt") ? "txt" : result.output.endsWith(".json") ? "json" : result.output;
        result.tmpXmlFileName = os.tmpdir() + "/codeNarcReportXml_" + Math.random() + ".xml";
        result.codenarcArgs.push('-report=xml:"' + result.tmpXmlFileName + '"');
    } else if (["html", "xml"].includes(result.output.split(".").pop())) {
        result.outputType = result.output
            .split(".")
            .pop()
            .endsWith("html")
            ? "html"
            : result.output
                  .split(".")
                  .pop()
                  .endsWith("xml")
            ? "xml"
            : "";
        const ext = result.output.split(".").pop();
        result.codenarcArgs.push('-report="' + ext + ":" + result.output + '"');

        // If filename is sent: just call codeNarc, no parsing results
        if (!["html", "xml"].includes(result.output)) {
            result.onlyCodeNarc = true;
        }
    } else {
        result.status = 2;
        throw new Error("For now, only output formats are txt and json in console, and html and xml as files");
    }
    return result;
}

// Parse XML result file as js object
async function parseCodeNarcResult(options, codeNarcBaseDir, tmpXmlFileName) {
    const parser = new xml2js.Parser();
    const tempXmlFileContent = await parser.parseStringPromise(fse.readFileSync(tmpXmlFileName), {});
    if (!tempXmlFileContent || !tempXmlFileContent.CodeNarc || !tempXmlFileContent.CodeNarc.Package) {
        console.error(JSON.stringify(tempXmlFileContent));
        throw new Error("Unable to parse temporary codenarc xml report file " + tmpXmlFileName);
    }
    const result = { summary: {} };

    // Parse main result
    const pcgkSummary = tempXmlFileContent.CodeNarc.PackageSummary[0]["$"];
    result.summary.totalFilesWithErrorsNumber = parseInt(pcgkSummary.filesWithViolations, 10);
    result.summary.totalFilesLinted = parseInt(pcgkSummary.totalFiles, 10);
    result.summary.totalFoundErrorNumber = parseInt(pcgkSummary.priority1, 10);
    result.summary.totalFoundWarningNumber = parseInt(pcgkSummary.priority2, 10);
    result.summary.totalFoundInfoNumber = parseInt(pcgkSummary.priority3, 10);

    // Parse files & violations
    const files = {};
    let errId = 0;
    for (const folderInfo of tempXmlFileContent.CodeNarc.Package) {
        if (!folderInfo.File) {
            debug(`Warning: ${folderInfo} does not contain any File item`);
            continue;
        }
        for (const fileInfo of folderInfo.File) {
            // Build file name, or use '0' if source has been sent as input parameter
            const fileNm = options.source ? 0 : codeNarcBaseDir + "/" + (folderInfo["$"].path ? folderInfo["$"].path + "/" : "") + fileInfo["$"].name;
            if (files[fileNm] == null) {
                files[fileNm] = { errors: [] };
            }
            // Get source code from file or input parameter
            let allLines = await getSourceLines(options.source, fileNm);

            for (const violation of fileInfo.Violation) {
                const errItem = {
                    id: errId,
                    line: violation["$"].lineNumber ? parseInt(violation["$"].lineNumber, 10) : 0,
                    rule: violation["$"].ruleName,
                    severity:
                        violation["$"].priority === "1"
                            ? "error"
                            : violation["$"].priority === "2"
                            ? "warning"
                            : violation["$"].priority === "3"
                            ? "info"
                            : "unknown",
                    msg: violation.Message ? violation.Message[0] : ""
                };
                // Find range & add error only if severity is matching logLevel
                if (
                    errItem.severity === "error" ||
                    options.loglevel === "info" ||
                    (options.loglevel === "warning" && ["error", "warning"].includes(errItem.severity))
                ) {
                    // Get fixable info & range if they have been defined on the rule
                    const errRule = npmGroovyLintRules[errItem.rule];
                    if (errRule) {
                        if (errRule.fix) {
                            errItem.fixable = true;
                            errItem.fixLabel = errRule.fix.label || `Fix ${errItem.rule}`;
                        }
                        if (errRule.range) {
                            const evaluatedVars = evaluateVariables(errRule.variables, errItem.msg, { verbose: options.verbose });
                            const errLine = allLines[errItem.line - 1];
                            const range = evaluateRange(errItem, errRule, evaluatedVars, errLine, allLines, { verbose: options.verbose });
                            if (range) {
                                errItem.range = range;
                            }
                        }
                    }
                    // Add in file errors
                    files[fileNm].errors.push(errItem);
                    errId++;
                }
            }
        }
    }
    // Complete with files with no error

    result.files = files;
    return result;
}

// Build RuleSet file from configuration
async function manageCreateRuleSetFile(options) {
    let ruleSetsDef;

    // List of rule strings sent as arguments/options, convert them as ruleSet defs
    if (options.rulesets && !notCodeNarcRuleNames.includes(options.rulesets) && !options.rulesets.includes(".")) {
        let ruleList = options.rulesets.split(",");
        ruleSetsDef = ruleList.map(ruleName => {
            return { name: ruleName };
        });
    }

    // If ruleSetDef , create temporary file
    if (ruleSetsDef) {
        // Create groovy ruleset definition
        let ruleSetSource = `ruleset {\n\n    description 'Generated by npm-groovy-lint (https://github.com/nvuillam/npm-groovy-lint#readme)'\n\n`;
        for (const rule of ruleSetsDef) {
            if (!(npmGroovyLintRules[rule.name] && npmGroovyLintRules[rule.name].isCodeNarcRule === false)) {
                ruleSetSource += `    ${rule.name}\n`;
            }
        }
        ruleSetSource += `\n}\n`;
        // Write file
        const tmpRuleSetFileNm = os.tmpdir() + "/codeNarcTmpRs_" + Math.random() + ".groovy";
        await fse.writeFile(tmpRuleSetFileNm, ruleSetSource);
        debug(`CREATE RULESET tmp file ${tmpRuleSetFileNm} generated from input options, as CodeNarc requires physical files`);
        return tmpRuleSetFileNm;
    } else {
        return null;
    }
}

async function manageDeleteTmpFiles(tmpGroovyFileName, tmpRuleSetFileName) {
    // Remove temporary groovy file created for source argument if provided
    if (tmpGroovyFileName) {
        await fse.remove(tmpGroovyFileName);
        debug(`Removed temp file ${tmpGroovyFileName} as it is not longer used`);
        tmpGroovyFileName = null;
    }
    // Remove temporary ruleSet file created for source argument if provided
    if (tmpRuleSetFileName) {
        await fse.remove(tmpRuleSetFileName);
        debug(`Removed temp RuleSet file ${tmpRuleSetFileName} as it is not longer used`);
        tmpRuleSetFileName = null;
    }
}

module.exports = { prepareCodeNarcCall, parseCodeNarcResult, manageDeleteTmpFiles };
