#! /usr/bin/env node
"use strict"

// Shared functions
const debug = require("debug")("npm-groovy-lint");
const fse = require("fs-extra");
const os = require("os");
const path = require("path");
const xml2js = require("xml2js");
const { getConfigFileName } = require("./config.js");
const { getNpmGroovyLintRules } = require("./groovy-lint-rules.js");
const { evaluateRange, evaluateVariables, getSourceLines } = require("./utils.js");

////////////////////////////
// Build codenarc options //
////////////////////////////

const npmGroovyLintRules = getNpmGroovyLintRules();
const CODENARC_TMP_FILENAME_BASE = "codeNarcTmpFile_";
const CODENARC_WWW_BASE = "https://codenarc.github.io/CodeNarc";

// Convert NPM-groovy-lint into codeNarc arguments
// Create temporary files if necessary
async function prepareCodeNarcCall(options) {
    const result = { codenarcArgs: [] };

    let cnPath = options.path;
    let cnFiles = options.files;

    // If source option, create a temporary Groovy file
    if (options.source) {
        cnPath = path.resolve(os.tmpdir() + "/npm-groovy-lint");
        await fse.ensureDir(cnPath);
        // File path is sent (recommended): use it to create temp file name
        if (options.sourcefilepath) {
            const pathParse = path.parse(options.sourcefilepath);
            cnPath = cnPath + "/codeNarcTmpDir_" + Math.random();
            await fse.ensureDir(cnPath);
            result.tmpGroovyFileName = path.resolve(cnPath + "/" + pathParse.base);
            cnFiles = "**/" + pathParse.base;
        }
        // Use default random file name
        else {
            const tmpFileNm = CODENARC_TMP_FILENAME_BASE + Math.random() + ".groovy";
            result.tmpGroovyFileName = path.resolve(cnPath + "/" + tmpFileNm);
            cnFiles = "**/" + tmpFileNm;
        }

        await fse.writeFile(result.tmpGroovyFileName, options.source);
        debug(`CREATE GROOVY temp file ${result.tmpGroovyFileName} with input source, as CodeNarc requires physical files`);
    }

    // Define base directory
    const baseBefore = (cnPath !== "." && cnPath.startsWith("/")) || cnPath.includes(":/") || cnPath.includes(":\\") ? "" : process.cwd() + "/";
    result.codeNarcBaseDir = cnPath !== "." ? baseBefore + cnPath.replace(/^"(.*)"$/, "$1") : process.cwd();
    result.codeNarcBaseDir = path.resolve(result.codeNarcBaseDir);
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
        await fse.ensureDir(os.tmpdir() + "/npm-groovy-lint");
        result.tmpXmlFileName = path.resolve(os.tmpdir() + "/npm-groovy-lint/codeNarcReportXml_" + Math.random() + ".xml");
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
async function parseCodeNarcResult(options, codeNarcBaseDir, tmpXmlFileName, tmpGroovyFileName) {
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

    const tmpGroovyFileNameReplace =
        tmpGroovyFileName && tmpGroovyFileName.includes(CODENARC_TMP_FILENAME_BASE) ? path.parse(tmpGroovyFileName).base : null;

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
                errItem.msg = tmpGroovyFileNameReplace ? errItem.msg.replace(tmpGroovyFileNameReplace, "") : errItem.msg;
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
    result.files = files;

    // Parse error definitions & build url if not already done and not noreturnrules option
    if (result.rules == null && options.returnrules === true) {
        const configAllFileName = await getConfigFileName(__dirname, null, [".groovylintrc-all.json"]);
        const grooylintrcAllRules = Object.keys(JSON.parse(fse.readFileSync(configAllFileName, "utf8").toString()).rules);
        const rules = {};
        for (const ruleDef of tempXmlFileContent.CodeNarc.Rules[0].Rule) {
            const ruleName = ruleDef["$"].name;
            // Add description from CodeNarc
            rules[ruleName] = { description: ruleDef.Description[0] };
            // Try to build codenarc url (ex: https://codenarc.github.io/CodeNarc/codenarc-rules-basic.html#bitwiseoperatorinconditional-rule )
            const matchRules = grooylintrcAllRules.filter(ruleNameX => ruleNameX.split(".")[1] === ruleName);
            if (matchRules && matchRules[0]) {
                const ruleCategory = matchRules[0].split(".")[0];
                const ruleDocUrl = `${CODENARC_WWW_BASE}/codenarc-rules-${ruleCategory}.html#${ruleName.toLowerCase()}-rule`;
                rules[ruleName].docUrl = ruleDocUrl;
            }
        }
        result.rules = rules;
    }

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
            const ruleFromConfig = options.rules[ruleName];
            const ruleDef = buildCodeNarcRule(ruleName, ruleFromConfig);
            return ruleDef;
        });
    }
    // Rules from config file, only if rulesets has not been sent as argument
    if (ruleSetsDef.length === 0 && options.rules) {
        for (const ruleName of Object.keys(options.rules)) {
            const ruleFromConfig = options.rules[ruleName];
            if (!(ruleFromConfig === "off" || ruleFromConfig.disabled === true || ruleFromConfig.enabled === false)) {
                const codeNarcRule = buildCodeNarcRule(ruleName, ruleFromConfig);
                ruleSetsDef.push(codeNarcRule);
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
        await fse.ensureDir(path.resolve(os.tmpdir() + "/npm-groovy-lint"));
        const tmpRuleSetFileName = path.resolve(os.tmpdir() + "/npm-groovy-lint/codeNarcTmpRs_" + Math.random() + ".groovy");
        await fse.writeFile(tmpRuleSetFileName, ruleSetSource);
        debug(`CREATE RULESET tmp file ${tmpRuleSetFileName} generated from input options, as CodeNarc requires physical files`);
        return tmpRuleSetFileName;
    }
}

// Build a CodeNarc rule from groovylint.json config rule
function buildCodeNarcRule(ruleName, ruleFromConfig) {
    const ruleNameShort = ruleName.includes(".") ? ruleName.split(".")[1] : ruleName;
    const codeNarcRule = { ruleName: ruleNameShort };
    // Convert NpmGroovyLint severity into codeNarc priority
    const codeNarcPriorityCode = getCodeNarcPriorityCode(ruleFromConfig || {});
    if (codeNarcPriorityCode) {
        codeNarcRule.priority = codeNarcPriorityCode;
    }
    // Asssign extra rule parameters if defined
    if (ruleFromConfig && typeof ruleFromConfig === "object") {
        delete ruleFromConfig.severity;
        return Object.assign(codeNarcRule, ruleFromConfig);
    } else {
        return codeNarcRule;
    }
}

// Translate config priority into CodeNarc priority code
function getCodeNarcPriorityCode(ruleFromConfig) {
    if (["error", "err"].includes(ruleFromConfig) || ["error", "err"].includes(ruleFromConfig.severity)) {
        return 1;
    } else if (["warning", "warn"].includes(ruleFromConfig) || ["warning", "warn"].includes(ruleFromConfig.severity)) {
        return 2;
    } else if (["info", "audi"].includes(ruleFromConfig) || ["info", "audi"].includes(ruleFromConfig.severity)) {
        return 3;
    }
    return null;
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
