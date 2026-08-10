// Configuration file management

import { debuglog } from "node:util";
const debug = debuglog("npm-groovy-lint");
import { existsSync, readFileSync } from "node:fs";
import fs from "node:fs/promises";
import * as path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const requireCjs = createRequire(import.meta.url);

// Import a module bypassing caches, so config file updates are taken into account (replaces the import-fresh package).
// CJS config files are loaded with require after clearing their require-cache tree (their own entry and the
// local modules they require): this guarantees a full fresh re-execution, which import() cannot provide for
// CJS modules. ES module config files are loaded with a dynamic import made unique by a query string.
// The format is resolved from the extension and the nearest package.json "type", like Node does: probing by
// calling require() first would execute an ES module config twice, as require(esm) succeeds since Node 22.12.
let importFreshCounter = 0;
const detectedEsModulePaths = new Set();
function forgetChild(parentModule, childModule) {
    // Deleting the cache entry is not enough: the parent keeps the evicted Module in its children array,
    // and the next require pushes a new one next to it, so the array grows on every reload
    const children = parentModule?.children;
    if (Array.isArray(children)) {
        const index = children.indexOf(childModule);
        if (index !== -1) {
            children.splice(index, 1);
        }
    }
}
function clearRequireCacheTree(modulePath, seen = new Set()) {
    const cached = requireCjs.cache[modulePath];
    if (cached == null || seen.has(modulePath)) {
        return;
    }
    seen.add(modulePath);
    for (const child of [...cached.children]) {
        // Only evict the local files the config is built from: evicting installed packages too would
        // re-execute them on every load, duplicating their singletons and breaking native addons
        if (!child.id.includes(`${path.sep}node_modules${path.sep}`)) {
            clearRequireCacheTree(child.id, seen);
            forgetChild(cached, child);
        }
    }
    forgetChild(cached.parent, cached);
    delete requireCjs.cache[modulePath];
}
function isEsModuleFile(resolvedPath) {
    const extension = path.extname(resolvedPath).toLowerCase();
    if (extension === ".mjs") {
        return true;
    }
    if (extension === ".cjs") {
        return false;
    }
    // .js: ES module only if the nearest package.json declares "type": "module"
    let dir = path.dirname(resolvedPath);
    for (let parent = null; parent !== dir; dir = path.dirname(dir)) {
        parent = dir;
        const packageJsonFile = path.join(dir, "package.json");
        if (existsSync(packageJsonFile)) {
            try {
                return JSON.parse(readFileSync(packageJsonFile, "utf8")).type === "module";
            } catch {
                // Unreadable or invalid package.json: fall back to CommonJS, like Node does
                return false;
            }
        }
    }
    return false;
}
async function importFresh(filePath) {
    const resolvedPath = path.resolve(filePath);
    if (isEsModuleFile(resolvedPath) || detectedEsModulePaths.has(resolvedPath)) {
        // ES module config file: bypass the ESM cache with a query string keyed on the file content.
        // Node cannot evict entries from the ES module registry, so a counter would add a dead record on
        // every lint of a long-lived host (the VS Code extension). Hashing the content instead bounds the
        // registry by the number of distinct config versions, and unlike an mtime key it cannot serve a
        // stale config: different content always produces a different specifier.
        // Known limitation, shared by any query-string approach: a relative import does not inherit the
        // parent query string, so local modules the config imports keep their first-loaded version for the
        // lifetime of the process. The CJS branch below does reload them, via the require cache tree.
        let contentKey;
        try {
            contentKey = createHash("sha1").update(readFileSync(resolvedPath)).digest("hex");
        } catch {
            // Unreadable file: let import() report the real error, with a key that is never reused
            contentKey = `unread-${importFreshCounter++}`;
        }
        return await import(`${pathToFileURL(resolvedPath).href}?fresh=${contentKey}`);
    }
    clearRequireCacheTree(requireCjs.resolve(resolvedPath));
    const moduleLoaded = requireCjs(resolvedPath);
    // A .js file written with ES module syntax, in a package that does not declare "type": "module", is
    // still detected as a module by Node, and require() then returns its namespace. Unwrap it, otherwise
    // the namespace itself would be taken for the config and every user rule would be dropped silently.
    // Route later reloads through import(), the only loader that re-executes it.
    if (moduleLoaded != null && moduleLoaded[Symbol.toStringTag] === "Module") {
        detectedEsModulePaths.add(resolvedPath);
        return { default: moduleLoaded.default };
    }
    return { default: moduleLoaded };
}

// Replace // and /* */ comments with whitespace so commented JSON config files can be parsed with JSON.parse
// (replaces the strip-json-comments package). Newlines are kept so JSON.parse error positions stay correct.
function stripJsonComments(jsonString) {
    let insideString = false;
    let insideSingleLineComment = false;
    let insideMultiLineComment = false;
    let multiLineCommentStart = -1;
    let result = "";
    for (let i = 0; i < jsonString.length; i++) {
        const currentChar = jsonString[i];
        const nextChar = jsonString[i + 1];
        if (insideSingleLineComment) {
            if (currentChar === "\n" || currentChar === "\r") {
                insideSingleLineComment = false;
                result += currentChar;
            } else {
                result += " ";
            }
        } else if (insideMultiLineComment) {
            if (currentChar === "*" && nextChar === "/") {
                insideMultiLineComment = false;
                result += "  ";
                i++;
            } else {
                result += currentChar === "\n" || currentChar === "\r" ? currentChar : " ";
            }
        } else if (insideString) {
            result += currentChar;
            if (currentChar === "\\") {
                // Keep the escaped character as-is (also covers escaped double quotes)
                result += nextChar ?? "";
                i++;
            } else if (currentChar === '"') {
                insideString = false;
            }
        } else if (currentChar === '"') {
            insideString = true;
            result += currentChar;
        } else if (currentChar === "/" && nextChar === "/") {
            insideSingleLineComment = true;
            result += "  ";
            i++;
        } else if (currentChar === "/" && nextChar === "*") {
            insideMultiLineComment = true;
            multiLineCommentStart = i;
            result += "  ";
            i++;
        } else {
            result += currentChar;
        }
    }
    if (insideMultiLineComment) {
        // Unterminated block comment: leave it in place so JSON.parse rejects the file, rather than
        // blanking out everything after it and accepting a config truncated mid-write as valid
        return result.slice(0, multiLineCommentStart) + jsonString.slice(multiLineCommentStart);
    }
    return result;
}

const defaultConfigLintFileName = ".groovylintrc-recommended.json";
const allConfigLintFileName = ".groovylintrc-all.json";

const NPM_GROOVY_LINT_CONSTANTS = {
    CodeNarcVersion: "2.2.0",
    GroovyVersion: "3.0.9",
};

const configLintFilenames = [
    ".groovylintrc.json",
    ".groovylintrc.js",
    ".groovylintrc.cjs",
    ".groovylintrc.yml",
    ".groovylintrc.yaml",
    ".groovylintrc",
    "package.json",
];

const configExtensions = ["json", "js", "cjs", "yml", "yaml", "groovylintrc"];

const defaultConfigFormatFileName = ".groovylintrc-format.json";

const configFormatFilenames = [".groovylintrc-format.json", ".groovylintrc-format.js"];

let overriddenRules;

// Load configuration from identified file, or find config file from a start path
async function loadConfig(startPathOrFile, mode = "lint", sourcefilepath, fileNamesIn = []) {
    let fileNames = [...fileNamesIn];
    // Load config
    let configUser;
    let configFilePath;
    if (configExtensions.includes(startPathOrFile.split(".").pop()) && mode !== "format") {
        // Sent file name
        configFilePath = startPathOrFile;
        configUser = await loadConfigFromFile(startPathOrFile);
    } else if (startPathOrFile.match(/^[a-zA-Z\d-_]+$/) && mode !== "format") {
        // Sent string: find a corresponding file name
        fileNames = configExtensions.map((ext) => `.groovylintrc-${startPathOrFile}.${ext}`);
        configFilePath = await getConfigFileName(sourcefilepath || process.cwd(), sourcefilepath, fileNames, "");
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
        configFilePath = await getConfigFileName(startPathOrFile, sourcefilepath, fileNames, defaultConfig);
        // Load user configuration from file
        configUser = await loadConfigFromFile(configFilePath);
    }
    // Complete PATH to codeNarc rulesets if defined in .groovylintrc
    if (configFilePath && configUser.codenarcRulesets) {
        // Set ruleSet file if found from config file
        configUser.rulesets = configUser.codenarcRulesets
            .split(",")
            .map((rulesetFile) => path.resolve(path.dirname(configFilePath) + "/" + rulesetFile))
            .join(",");
    }

    // Shorten rule names if long rule names Cat.Rule replaced by Ru
    configUser.rules = await shortenRuleNames(configUser.rules || {});
    // If config extends a standard one, merge it
    configUser = await manageExtends(configUser);
    // If mode = "format", call user defined rules to apply them upon the default formatting rules
    if (mode === "format") {
        const customUserConfig = await loadConfig(startPathOrFile, "lint", sourcefilepath, fileNamesIn);
        for (const ruleKey of Object.keys(customUserConfig.rules)) {
            if (configUser.rules[ruleKey]) {
                configUser.rules[ruleKey] = customUserConfig.rules[ruleKey];
            }
        }
    }
    if (overriddenRules != null) {
        configUser.overriddenRules = overriddenRules;
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
            const stat = await fs.lstat(sourcefilepath);
            const dir = stat.isDirectory() ? sourcefilepath : path.parse(sourcefilepath).dir;
            configFilePath = await findConfigInPath(dir, fileNames);
        } catch (e) {
            debug(`Unable to find config file for ${sourcefilepath} (${e.message})`);
        }
    }
    // Find one of the config file formats at the root of the project or at upper directory levels
    if (configFilePath == null) {
        try {
            const stat = await fs.lstat(startPathOrFile);
            const dir = stat.isDirectory ? startPathOrFile : path.parse(startPathOrFile).dir;
            configFilePath = await findConfigInPath(dir, fileNames);
        } catch (e) {
            debug(`Unable to find config file for ${sourcefilepath} (${e.message})`);
        }
    }
    // Custom file names: try to find matching file
    if (configFilePath == null && defaultConfig === "") {
        configFilePath = await findConfigInPath(__dirname, fileNames);
    }
    // If not found, use .groovylintrc-recommended.js delivered with npm-groovy-lint
    if (configFilePath == null) {
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
        if (existsSync(filePath)) {
            if (filename === "package.json") {
                try {
                    await loadPackageJSONConfigFile(filePath);
                    return filePath;
                } catch (error) {
                    /* ignore */
                    debug("Error loading JSON config file: " + error.message);
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
    let configLoaded;
    switch (path.extname(filePath)) {
        case ".js":
        case ".cjs":
            configLoaded = await loadJSConfigFile(filePath);
            break;
        case ".json":
            if (path.basename(filePath) === "package.json") {
                configLoaded = await loadPackageJSONConfigFile(filePath);
            } else {
                configLoaded = await loadJSONConfigFile(filePath);
            }
            break;
        case ".yaml":
        case ".yml":
            configLoaded = await loadYAMLConfigFile(filePath);
            break;
        default:
            configLoaded = null;
    }
    if (configLoaded != null && !filePath.includes(defaultConfigLintFileName) && !filePath.includes(allConfigLintFileName)) {
        overriddenRules = configLoaded.rules;
    }
    return configLoaded;
}

// Javascript format
async function loadJSConfigFile(filePath) {
    try {
        const moduleLoaded = await importFresh(filePath);
        // Normalize CommonJS default export and clone to avoid frozen namespace objects
        const config = moduleLoaded && typeof moduleLoaded === "object" && "default" in moduleLoaded ? moduleLoaded.default : moduleLoaded;
        return config && typeof config === "object" ? { ...config } : config;
    } catch (e) {
        debug(`Error reading JavaScript file: ${filePath}`);
        e.message = `Cannot read config file: ${filePath}\nError: ${e.message}`;
        throw e;
    }
}

// JSON format
async function loadJSONConfigFile(filePath) {
    try {
        const fileContent = await fs.readFile(filePath);
        return JSON.parse(stripJsonComments(fileContent.toString()));
    } catch (e) {
        debug(`Error reading JSON file: ${filePath}`);
        e.message = `Cannot read config file: ${filePath}\nError: ${e.message}`;
        e.messageTemplate = "failed-to-read-json";
        e.messageData = {
            path: filePath,
            message: e.message,
        };
        throw e;
    }
}

// YAML format
async function loadYAMLConfigFile(filePath) {
    // lazy load YAML to improve performance when not used
    const yaml = await import("js-yaml");

    try {
        // empty YAML file can be null, so always use
        const fileContent = await readFile(filePath);
        return yaml.load(fileContent) || {};
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
    const fileContent = await fs.readFile(filePath, "utf8");
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

export { NPM_GROOVY_LINT_CONSTANTS, loadConfig, getConfigFileName, overriddenRules };
