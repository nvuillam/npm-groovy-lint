// Configuration file management
"use strict";

const debug = require("debug")("npm-groovy-lint");
const fse = require("fs-extra");
const importFresh = require("import-fresh");
const path = require("path");
const stripComments = require("strip-json-comments");

const defaultConfigFileName = ".groovylintrc-recommended.json";

const configFilenames = [
    ".groovylintrc.json",
    ".groovylintrc.js",
    ".groovylintrc.cjs",
    ".groovylintrc.yml",
    ".groovylintrc.yaml",
    ".groovylintrc",
    "package.json"
];

// Load configuration from identified file, or find config file from a start path
async function loadConfig(startPathOrFile) {
    const configFilePath = await getConfigFileName(startPathOrFile);
    // Load user configuration from file
    let configUser = await loadConfigFromFile(configFilePath);
    configUser.rules = await shortenRuleNames(configUser.rules || {});
    // If config extends a standard one, merge it
    configUser = await manageExtends(configUser);
    return configUser;
}

// If extends defined, gather base level rules and append them to current rules
async function manageExtends(configUser) {
    if (configUser.extends) {
        const baseConfigFilePath = await findConfigInPath(__dirname, [`.groovylintrc-${configUser.extends}.json`]);
        let baseConfig = await loadConfigFromFile(baseConfigFilePath);
        baseConfig.rules = await shortenRuleNames(baseConfig.rules || {});
        // A config can extend another config that extends another config
        baseConfig = await manageExtends(baseConfig);
        // Delete doublons
        for (const baseRuleName of Object.keys(baseConfig.rules)) {
            for (const userRuleName of Object.keys(configUser.rules)) {
                if (baseRuleName.includes(userRuleName)) {
                    delete baseConfig.rules[baseRuleName];
                }
            }
        }
        configUser.rules = Object.assign(baseConfig.rules, configUser.rules);
        delete configUser.extends;
    }
    return configUser;
}

async function getConfigFileName(startPathOrFile) {
    let configFilePath = null;
    const stat = await fse.lstat(startPathOrFile);
    // Find one of the config file formats at the root of the project or at upper directory levels
    if (stat.isDirectory()) {
        configFilePath = await findConfigInPath(startPathOrFile, configFilenames);
    }
    if (configFilePath == null) {
        // If not found, use .groovylintrc-recommended.js delivered with npm-groovy-lint
        configFilePath = await findConfigInPath(__dirname, [defaultConfigFileName]);
    }
    return configFilePath;
}

// try to  find a config file or config prop in package.json
async function findConfigInPath(directoryPath, configFilenamesIn) {
    for (const filename of configFilenamesIn) {
        const filePath = path.join(directoryPath, filename);
        if (await fse.exists(filePath)) {
            if (filename === "package.json") {
                try {
                    await loadPackageJSONConfigFile(filePath);
                    return filePath;
                } catch (error) {
                    /* ignore */
                }
            } else {
                return filePath;
            }
        }
    }
    //if not found, try parent directory
    const parentPath = path.dirname(directoryPath);
    if (parentPath && parentPath !== directoryPath) {
        return await findConfigInPath(parentPath, configFilenamesIn);
    }
    return null;
}

async function loadConfigFromFile(filePath) {
    switch (path.extname(filePath)) {
        case ".js":
        case ".cjs":
            return await loadJSConfigFile(filePath);

        case ".json":
            if (path.basename(filePath) === "package.json") {
                return await loadPackageJSONConfigFile(filePath);
            }
            return await loadJSONConfigFile(filePath);

        case ".yaml":
        case ".yml":
            return await loadYAMLConfigFile(filePath);
        default:
            return null;
    }
}

async function loadJSConfigFile(filePath) {
    debug(`Loading JS config file: ${filePath}`);
    try {
        return importFresh(filePath);
    } catch (e) {
        debug(`Error reading JavaScript file: ${filePath}`);
        e.message = `Cannot read config file: ${filePath}\nError: ${e.message}`;
        throw e;
    }
}

async function loadJSONConfigFile(filePath) {
    debug(`Loading JSON config file: ${filePath}`);
    try {
        return JSON.parse(stripComments(await readFile(filePath)));
    } catch (e) {
        debug(`Error reading JSON file: ${filePath}`);
        e.message = `Cannot read config file: ${filePath}\nError: ${e.message}`;
        e.messageTemplate = "failed-to-read-json";
        e.messageData = {
            path: filePath,
            message: e.message
        };
        throw e;
    }
}

async function loadYAMLConfigFile(filePath) {
    debug(`Loading YAML config file: ${filePath}`);

    // lazy load YAML to improve performance when not used
    const yaml = require("js-yaml");

    try {
        // empty YAML file can be null, so always use
        return yaml.safeLoad(await readFile(filePath)) || {};
    } catch (e) {
        debug(`Error reading YAML file: ${filePath}`);
        e.message = `Cannot read config file: ${filePath}\nError: ${e.message}`;
        throw e;
    }
}

async function loadPackageJSONConfigFile(filePath) {
    debug(`Loading package.json config file: ${filePath}`);
    try {
        const packageData = await loadJSONConfigFile(filePath);

        if (!Object.hasOwnProperty.call(packageData, "groovylintConfig")) {
            throw Object.assign(new Error("package.json file doesn't have 'groovylintConfig' field."), { code: "GROOVYLINT_CONFIG_FIELD_NOT_FOUND" });
        }
        return packageData.groovylintConfig;
    } catch (e) {
        debug(`Error reading package.json file: ${filePath}`);
        e.message = `Cannot read config file: ${filePath}\nError: ${e.message}`;
        throw e;
    }
}

async function readFile(filePath) {
    const fileContent = await fse.readFile(filePath, "utf8");
    return fileContent.replace(/^\ufeff/u, "");
}

// Remove rule category of rule name if defined. Ex: "basic.ConstantAssertExpression" beccomes "ConstantAssertExpression"
async function shortenRuleNames(rules) {
    const shortenedRules = {};
    for (const ruleName of Object.keys(rules)) {
        const ruleNameShort = ruleName.includes(".") ? ruleName.split(".")[1] : ruleName;
        shortenedRules[ruleNameShort] = rules[ruleName];
    }
    return shortenedRules;
}

module.exports = { loadConfig, getConfigFileName };
