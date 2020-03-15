// Configuration file management
"use strict";

const debug = require("debug")("npm-groovy-lint");
const fse = require("fs-extra");
const importFresh = require("import-fresh");
const path = require("path");
const stripComments = require("strip-json-comments");

const configFilenames = [
    ".groovylintrc.js",
    ".groovylintrc.cjs",
    ".groovylintrc.json",
    ".groovylintrc.yml",
    ".groovylintrc.yaml",
    ".groovylintrc",
    "package.json"
];

// Load configuration from identified file, or find config file from a start path
async function loadConfig(startPathOrFile) {
    let configFilePath = null;
    const stat = await fse.lstat(startPathOrFile);
    // Find one of the config file formats at the root of the project or at upper directory levels
    if (stat.isDirectory()) {
        configFilePath = await findConfigInPath(startPathOrFile, configFilenames);
    }
    if (configFilePath == null) {
        // If not found, use .groovylintrc-recommended.js delivered with npm-groovy-lint
        configFilePath = await findConfigInPath(__dirname, [".groovylintrc-recommended.js"]);
    }
    // Load user configuration from file
    const configUser = loadConfigFromFile(configFilePath);
    // If config extends a standard one, merge it
    if (configUser.extends) {
        const baseConfigFilePath = await findConfigInPath(__dirname, [`.groovylintrc-${configUser.extends}.js`]);
        const baseConfig = loadConfigFromFile(baseConfigFilePath);
        configUser.rules = Object.assign(baseConfig.rules, configUser.rules);
    }
    return configUser;
}

// try to  find a config file or config prop in package.json
async function findConfigInPath(directoryPath, configFilenamesIn) {
    for (const filename of configFilenamesIn) {
        const filePath = path.join(directoryPath, filename);
        if (await fse.exists(filePath)) {
            if (filename === "package.json") {
                try {
                    loadPackageJSONConfigFile(filePath);
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

function loadConfigFromFile(filePath) {
    switch (path.extname(filePath)) {
        case ".js":
        case ".cjs":
            return loadJSConfigFile(filePath);

        case ".json":
            if (path.basename(filePath) === "package.json") {
                return loadPackageJSONConfigFile(filePath);
            }
            return loadJSONConfigFile(filePath);

        case ".yaml":
        case ".yml":
            return loadYAMLConfigFile(filePath);
        default:
            return null;
    }
}

function loadJSConfigFile(filePath) {
    debug(`Loading JS config file: ${filePath}`);
    try {
        return importFresh(filePath);
    } catch (e) {
        debug(`Error reading JavaScript file: ${filePath}`);
        e.message = `Cannot read config file: ${filePath}\nError: ${e.message}`;
        throw e;
    }
}

function loadJSONConfigFile(filePath) {
    debug(`Loading JSON config file: ${filePath}`);
    try {
        return JSON.parse(stripComments(readFile(filePath)));
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

function loadYAMLConfigFile(filePath) {
    debug(`Loading YAML config file: ${filePath}`);

    // lazy load YAML to improve performance when not used
    const yaml = require("js-yaml");

    try {
        // empty YAML file can be null, so always use
        return yaml.safeLoad(readFile(filePath)) || {};
    } catch (e) {
        debug(`Error reading YAML file: ${filePath}`);
        e.message = `Cannot read config file: ${filePath}\nError: ${e.message}`;
        throw e;
    }
}

function loadPackageJSONConfigFile(filePath) {
    debug(`Loading package.json config file: ${filePath}`);
    try {
        const packageData = loadJSONConfigFile(filePath);

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

module.exports = { loadConfig };
