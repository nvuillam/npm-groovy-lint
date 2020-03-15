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

// Convert NPM-groovy-lint into codeNarc arguments
// Create temporary files if necessary
async function prepareCodeNarcCall(options) {
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
    const ruleSetFileName = await manageCreateRuleSetFile(options);
    options.rulesets = ruleSetFileName;
    if (ruleSetFileName.includes("codeNarcTmpRs_")) {
        result.tmpRuleSetFileName = ruleSetFileName;
    }

    // Build ruleSet & file CodeNarc arguments
    let defaultFilesPattern = "**/*.groovy,**/Jenkinsfile";

    // RuleSet codeNarc arg
    result.codenarcArgs.push('-rulesetfiles="file:' + options.rulesets.replace(/^"(.*)"$/, "$1") + '"');

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
    // If RuleSet files has already been created, or is groovy file, return it
    if (options.rulesets && (options.rulesets.endsWith(".groovy") || options.rulesets.endsWith(".xml"))) {
        return options.rulesets;
    }

    let ruleSetsDef = [];

    // List of rule strings sent as arguments/options, convert them as ruleSet defs
    if (options.rulesets && !options.rulesets.includes(".")) {
        let ruleList = options.rulesets.split(",");
        ruleSetsDef = ruleList.map(ruleName => {
            const ruleNameShort = ruleName.includes(".") ? ruleName.split(".")[1] : ruleName;
            return { ruleName: ruleNameShort };
        });
    }
    // Rules from config file, only if rulesets has not been sent as argument
    if (ruleSetsDef.length === 0 && options.rules) {
        for (const ruleName of Object.keys(options.rules)) {
            const ruleFromConfig = options.rules[ruleName];
            if (!(ruleFromConfig === "off" || ruleFromConfig.disabled === true || ruleFromConfig.enabled === false)) {
                const ruleNameShort = ruleName.includes(".") ? ruleName.split(".")[1] : ruleName;
                const codeNarcRule = { ruleName: ruleNameShort };
                // Convert NpmGroovyLint severity into codeNarc priority
                if (["error", "err"].includes(ruleFromConfig) || ["error", "err"].includes(ruleFromConfig.severity)) {
                    codeNarcRule.priority = 1;
                } else if (["warning", "warn"].includes(ruleFromConfig) || ["warning", "warn"].includes(ruleFromConfig.severity)) {
                    codeNarcRule.priority = 2;
                } else if (["info", "audi"].includes(ruleFromConfig) || ["info", "audi"].includes(ruleFromConfig.severity)) {
                    codeNarcRule.priority = 3;
                }
                if (typeof ruleFromConfig === "object") {
                    delete ruleFromConfig.severity;
                    ruleSetsDef.push(Object.assign(codeNarcRule, ruleFromConfig));
                } else {
                    ruleSetsDef.push(codeNarcRule);
                }
            }
        }
    }

    // If ruleSetDef , create temporary RuleSet file
    if (ruleSetsDef && ruleSetsDef.length > 0) {
        // Sort & Create groovy ruleset definition
        ruleSetsDef = ruleSetsDef.sort((a, b) => a.ruleName.localeCompare(b.ruleName));
        let ruleSetSource = `ruleset {\n\n    description 'Generated by npm-groovy-lint (https://github.com/nvuillam/npm-groovy-lint#readme)'\n\n`;
        for (const rule of ruleSetsDef) {
            if (!(npmGroovyLintRules[rule.ruleName] && npmGroovyLintRules[rule.ruleName].isCodeNarcRule === false)) {
                const ruleDeclaration = `    ${rule.ruleName}(${stringifyWithoutPropQuotes(rule)})\n`;
                ruleSetSource += ruleDeclaration;
            }
        }
        ruleSetSource += `\n}\n`;
        // Write file
        const tmpRuleSetFileName = os.tmpdir() + "/codeNarcTmpRs_" + Math.random() + ".groovy";
        await fse.writeFile(tmpRuleSetFileName, ruleSetSource);
        debug(`CREATE RULESET tmp file ${tmpRuleSetFileName} generated from input options, as CodeNarc requires physical files`);
        return tmpRuleSetFileName;
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

function stringifyWithoutPropQuotes(obj_from_json) {
    if (typeof obj_from_json !== "object" || Array.isArray(obj_from_json)) {
        // not an object, stringify using native function
        return JSON.stringify(obj_from_json);
    }
    // Implements recursive object serialization according to JSON spec
    // but without quotes around the keys.
    delete obj_from_json.ruleName;
    let props = Object.keys(obj_from_json)
        .map(key => `${key}:${stringifyWithoutPropQuotes(obj_from_json[key])}`)
        .join(",");
    return `${props}`;
}

module.exports = { prepareCodeNarcCall, parseCodeNarcResult, manageDeleteTmpFiles };
