// Configuration file management
"use strict";

const debug = require("debug")("npm-groovy-lint");
const fse = require("fs-extra");
const importFresh = require("import-fresh");
const path = require("path");
const stripComments = require("strip-json-comments");

const defaultConfigLintFileName = ".groovylintrc-recommended.json";

const NPM_GROOVY_LINT_CONSTANTS = {
    CodeNarcVersion: "1.5",
    GroovyVersion: "3.0.3"
};

const configLintFilenames = [
    ".groovylintrc.json",
    ".groovylintrc.js",
    ".groovylintrc.cjs",
    ".groovylintrc.yml",
    ".groovylintrc.yaml",
    ".groovylintrc",
    "package.json"
];

const configExtensions = ["json", "js", "cjs", "yml", "yaml", "groovylintrc"];

const defaultConfigFormatFileName = ".groovylintrc-format.json";

const configFormatFilenames = [".groovylintrc-format.json", ".groovylintrc-format.js"];

// Load configuration from identified file, or find config file from a start path
async function loadConfig(startPathOrFile, mode = "lint", sourcefilepath, fileNamesIn = []) {
    let fileNames = [...fileNamesIn];
    // Load config
    let configUser = {};
    if (configExtensions.includes(startPathOrFile.split(".").pop()) && mode !== "format") {
        // Sent file name
        configUser = await loadConfigFromFile(startPathOrFile);
    } else if (startPathOrFile.match(/^[a-zA-Z\d-_]+$/) && mode !== "format") {
        // Sent string: file a corresponding file name
        fileNames = configExtensions.map(ext => `.groovylintrc-${startPathOrFile}.${ext}`);
        const configFilePath = await getConfigFileName(sourcefilepath || process.cwd(), sourcefilepath, fileNames, "");
        configUser = await loadConfigFromFile(configFilePath);
    } else {
        // sent directory
        let defaultConfig = defaultConfigLintFileName;
        if (mode === "lint" && fileNames.length === 0) {
            fileNames = configLintFilenames;
        } else if (mode === "format") {
            fileNames = fileNames.length === 0 ? configFormatFilenames : fileNames;
            defaultConfig = defaultConfigFormatFileName;
        }
        const configFilePath = await getConfigFileName(startPathOrFile, sourcefilepath, fileNames, defaultConfig);
        // Load user configuration from file
        configUser = await loadConfigFromFile(configFilePath);
    }
    // Shorten rule names if long rule names Cat.Rule replaced by Ru
    configUser.rules = await shortenRuleNames(configUser.rules || {});
    // If config extends a standard one, merge it
    configUser = await manageExtends(configUser);
    // If mode = "format", call user defined rules to apply them upon the default formatting rules
    if (mode === "format") {
        const customUserConfig = await loadConfig(startPathOrFile, "lint", sourcefilepath, fileNamesIn);
        for (const ruleKey of Object.keys(customUserConfig)) {
            if (configUser[ruleKey]) {
                configUser[ruleKey] = customUserConfig[ruleKey];
            }
        }
    }
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
                if (baseRuleName === userRuleName) {
                    delete baseConfig.rules[baseRuleName];
                }
            }
        }
        configUser.rules = Object.assign(baseConfig.rules, configUser.rules);
        delete configUser.extends;
    }
    return configUser;
}

// Returns configuration filename
async function getConfigFileName(startPathOrFile, sourcefilepath, fileNames = configLintFilenames, defaultConfig = defaultConfigLintFileName) {
    let configFilePath = null;
    // Find one of the config file formats are the root of the linted file (if source is sent with sourcefilepath)
    if ([".", process.cwd()].includes(startPathOrFile) && sourcefilepath) {
        try {
            const stat = await fse.lstat(sourcefilepath);
            const dir = stat.isDirectory() ? sourcefilepath : path.parse(sourcefilepath).dir;
            configFilePath = await findConfigInPath(dir, fileNames);
        } catch (e) {
            debug(`Unable to find config file for ${sourcefilepath} (${e.message})`);
        }
    }
    // Find one of the config file formats at the root of the project or at upper directory levels
    if (configFilePath == null) {
        try {
            const stat = await fse.lstat(startPathOrFile);
            const dir = stat.isDirectory ? startPathOrFile : path.parse(startPathOrFile).dir;
            configFilePath = await findConfigInPath(dir, fileNames);
        } catch (e) {
            debug(`Unable to find config file for ${sourcefilepath} (${e.message})`);
        }
    }
    if (configFilePath == null) {
        // If not found, use .groovylintrc-recommended.js delivered with npm-groovy-lint
        configFilePath = await findConfigInPath(__dirname, [defaultConfig]);
    }
    configFilePath = path.resolve(configFilePath);
    debug(`GroovyLint used config file: ${configFilePath}`);
    if (!configExtensions.includes(configFilePath.split(".").pop())) {
        throw new Error(`Unable to find a configuration file ${startPathOrFile}`);
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

// Load configuration depending of the file format
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

// Javascript format
async function loadJSConfigFile(filePath) {
    try {
        return importFresh(filePath);
    } catch (e) {
        debug(`Error reading JavaScript file: ${filePath}`);
        e.message = `Cannot read config file: ${filePath}\nError: ${e.message}`;
        throw e;
    }
}

// JSON format
async function loadJSONConfigFile(filePath) {
    try {
        const fileContent = await readFile(filePath);
        return JSON.parse(stripComments(fileContent));
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

// YAML format
async function loadYAMLConfigFile(filePath) {
    // lazy load YAML to improve performance when not used
    const yaml = require("js-yaml");

    try {
        // empty YAML file can be null, so always use
        const fileContent = await readFile(filePath);
        return yaml.safeLoad(fileContent) || {};
    } catch (e) {
        debug(`Error reading YAML file: ${filePath}`);
        e.message = `Cannot read config file: ${filePath}\nError: ${e.message}`;
        throw e;
    }
}

// json in package.json format
async function loadPackageJSONConfigFile(filePath) {
    try {
        const packageData = await loadJSONConfigFile(filePath);
        if (!Object.hasOwnProperty.call(packageData, "groovylintConfig")) {
            throw Object.assign(new Error(`${filePath} doesn't have 'groovylintConfig' property`), { code: "GROOVYLINT_CONFIG_FIELD_NOT_FOUND" });
        }
        return packageData.groovylintConfig;
    } catch (e) {
        debug(`Error reading package.json file: ${filePath}`);
        //e.message = `Cannot read config file: ${filePath}\nError: ${e.message}`;
        throw e;
    }
}

// Read file
async function readFile(filePath) {
    const fileContent = await fse.readFile(filePath, "utf8");
    return fileContent.replace(/^\ufeff/u, "");
}

// Remove rule category of rule name if defined. Ex: "basic.ConstantAssertExpression" becomes "ConstantAssertExpression"
async function shortenRuleNames(rules) {
    const shortenedRules = {};
    for (const ruleName of Object.keys(rules)) {
        const ruleNameShort = ruleName.includes(".") ? ruleName.split(".")[1] : ruleName;
        shortenedRules[ruleNameShort] = rules[ruleName];
    }
    return shortenedRules;
}

module.exports = { NPM_GROOVY_LINT_CONSTANTS, loadConfig, getConfigFileName };
