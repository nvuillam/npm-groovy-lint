import fs from "node:fs";
import fsPromises from "node:fs/promises";
import path from "path";
import os from "os";
import { Buffer } from "buffer";
import { execFileSync } from "child_process";
import { getNpmGroovyLintRules } from "../lib/groovy-lint-rules.js";
import { REST, RULE_TIERS, RULE_CONFIG, OVERRIDE_PRESETS, GENERATED_PRESETS } from "./rule-tiers.js";

const CODENARC_RESOURCES_BASE_URL = "https://raw.githubusercontent.com/CodeNarc/CodeNarc/master/src/main/resources";
// Build Json containing all CodeNarc rules
(async () => {
    // Imports
    const ruleSetAll = fs.readFileSync("lib/example/RuleSet-All.groovy", "utf8");
    const allLines = ruleSetAll.replace(/\r?\n/g, "\r\n").split("\r\n");

    function buildAllRules(allLines) {
        const rulesConfig = {};
        const metadata = {};
        let currentCategory = null;

        for (const line of allLines) {
            if (line.includes(".xml")) {
                const splits = line.split("/");
                currentCategory = splits[splits.length - 1].replace(".xml", "").trim();
                continue;
            }
            if (currentCategory && line.trim() !== "" && line.trim().match("^[a-zA-Z0-9]*$")) {
                const ruleName = line.trim();
                const propName = `${currentCategory}.${ruleName}`;
                const description = toSentence(ruleName);
                rulesConfig[propName] = {};
                metadata[propName] = {
                    category: currentCategory,
                    rule: ruleName,
                    shortName: ruleName,
                    description,
                };
            }
        }
        return { rulesConfig, metadata };
    }

    function toSentence(ruleName) {
        const spaced = ruleName.replace(/([A-Z])/g, " $1").trim();
        return spaced.charAt(0).toUpperCase() + spaced.slice(1);
    }

    const { rulesConfig: allRulesConfig, metadata: ruleMetadata } = buildAllRules(allLines);

    writePreset("all", { rules: allRulesConfig }, `Every CodeNarc rule bundled with npm-groovy-lint (${Object.keys(allRulesConfig).length}).`);

    generatePresets(ruleMetadata);

    const npmDefinedRules = await getNpmGroovyLintRules();
    const rulePropertyMetadata = await collectRulePropertyMetadata();
    await buildGroovyLintJsonSchema(ruleMetadata, npmDefinedRules, rulePropertyMetadata);
    const fixableRules = [];
    for (const rule of Object.keys(npmDefinedRules)) {
        if (npmDefinedRules[rule].fix) {
            fixableRules.push("- " + rule);
        }
    }
    fixableRules.sort();
    const mdLog = fixableRules.join("\n");
    console.log("Fixable rules :\n" + mdLog);
})();

// Write a preset next to the others, with a trailing newline. Generated presets are listed in
// .prettierignore, so the exact bytes written here are the ones committed.
function writePreset(name, content, description) {
    const filePath = `./lib/.groovylintrc-${name}.json`;
    fs.writeFileSync(filePath, JSON.stringify(content, null, 4) + "\n");
    console.log(`Generated ${filePath.replace("./", "")} - ${description}`);
}

// Spread every CodeNarc rule over the tiers declared in rule-tiers.js. Anything the table does not
// account for throws: a new CodeNarc category or a rule of a fully enumerated category has to be
// triaged explicitly rather than silently joining a preset (this is what let `recommended` drift
// to 386 rules back when it was `extends: all`).
function assignTiers(ruleMetadata) {
    const errors = [];
    const rulesByCategory = new Map();
    for (const [fullName, meta] of Object.entries(ruleMetadata)) {
        if (!rulesByCategory.has(meta.category)) {
            rulesByCategory.set(meta.category, []);
        }
        rulesByCategory.get(meta.category).push({ fullName, rule: meta.rule });
    }

    const tierRules = {};
    for (const [category, categoryRules] of rulesByCategory) {
        const tierDefinition = RULE_TIERS[category];
        if (tierDefinition == null) {
            errors.push(`Category "${category}" is missing from RULE_TIERS: assign its rules to a tier in scripts/rule-tiers.js`);
            continue;
        }
        const knownRules = new Set(categoryRules.map((entry) => entry.rule));
        const claimedBy = new Map();
        let restTier = null;
        for (const [tier, selection] of Object.entries(tierDefinition)) {
            if (selection === REST) {
                restTier = tier;
                continue;
            }
            for (const ruleName of selection) {
                if (!knownRules.has(ruleName)) {
                    errors.push(`RULE_TIERS lists "${category}.${ruleName}", which is not a CodeNarc rule of that category`);
                } else if (claimedBy.has(ruleName)) {
                    errors.push(`RULE_TIERS assigns "${category}.${ruleName}" to both "${claimedBy.get(ruleName)}" and "${tier}"`);
                }
                claimedBy.set(ruleName, tier);
            }
        }
        for (const { fullName, rule } of categoryRules) {
            const tier = claimedBy.get(rule) ?? restTier;
            if (tier == null) {
                errors.push(`Rule "${fullName}" is not assigned to a tier: add it to RULE_TIERS.${category}`);
                continue;
            }
            (tierRules[tier] ??= []).push(fullName);
        }
    }

    const allRuleNames = new Set(Object.keys(ruleMetadata));
    for (const ruleName of [...Object.keys(RULE_CONFIG), ...Object.values(OVERRIDE_PRESETS).flatMap((preset) => Object.keys(preset))]) {
        if (!allRuleNames.has(ruleName)) {
            errors.push(`"${ruleName}" is configured in scripts/rule-tiers.js but is not a known CodeNarc rule`);
        }
    }

    if (errors.length > 0) {
        throw new Error(`Rule tiers are inconsistent with the CodeNarc rule list:\n- ${errors.join("\n- ")}`);
    }
    return tierRules;
}

// Generate every preset but `format`, which is hand-maintained: it is the list of rules the
// formatting engine knows how to apply, not a tier of the lint rulesets.
function generatePresets(ruleMetadata) {
    const tierRules = assignTiers(ruleMetadata);
    for (const preset of GENERATED_PRESETS) {
        let content;
        if (preset.extends) {
            content = { extends: preset.extends };
        } else if (preset.overrides) {
            content = { rules: { ...OVERRIDE_PRESETS[preset.overrides] } };
        } else {
            const rules = {};
            for (const ruleName of preset.tiers.flatMap((tier) => tierRules[tier] ?? []).sort()) {
                rules[ruleName] = RULE_CONFIG[ruleName] ?? {};
            }
            content = { rules };
        }
        const ruleCount = content.rules ? Object.keys(content.rules).length : 0;
        writePreset(preset.name, content, content.rules ? `${ruleCount} rules. ${preset.header}` : preset.header);
    }
}

async function buildGroovyLintJsonSchema(ruleMetadata, npmDefinedRules, rulePropertyMetadata) {
    const severityEnum = ["off", "info", "warning", "error"];

    const rulesProperties = {};
    const allowedRuleNames = new Set();

    const addRuleProperty = (name, description) => {
        if (!name || allowedRuleNames.has(name)) {
            return;
        }
        allowedRuleNames.add(name);
        rulesProperties[name] = buildRuleSchema(description, name, rulePropertyMetadata, severityEnum);
    };

    Object.entries(ruleMetadata).forEach(([fullName, meta]) => {
        addRuleProperty(fullName, meta.description);
        addRuleProperty(meta.shortName, meta.description);
    });

    Object.entries(npmDefinedRules).forEach(([ruleName, ruleDefinition]) => {
        const description = ruleDefinition?.description;
        addRuleProperty(ruleName, description);
        if (ruleName.includes(".")) {
            addRuleProperty(ruleName.split(".").pop(), description);
        }
    });

    const availableExtends = await getAvailableBaseConfigs();

    const schema = {
        $schema: "http://json-schema.org/draft-07/schema#",
        $id: "https://nvuillam.github.io/npm-groovy-lint/groovy-lint.jsonschema.json",
        title: "npm-groovy-lint configuration",
        description: "Schema describing the .groovylintrc.json format",
        type: "object",
        additionalProperties: false,
        properties: {
            extends: {
                description:
                    "Name of a base configuration bundled with npm-groovy-lint, or a list of them merged from left to right (later entries win).",
                anyOf: [
                    { type: "string", enum: availableExtends },
                    { type: "array", minItems: 1, items: { type: "string", enum: availableExtends } },
                ],
            },
            rules: {
                type: "object",
                description: "Overrides for CodeNarc rules (string severity or advanced object).",
                additionalProperties: false,
                properties: rulesProperties,
                propertyNames: {
                    enum: Array.from(allowedRuleNames).sort(),
                },
            },
            codenarcRulesets: {
                type: "string",
                description: "Comma-separated list of CodeNarc RuleSet files. When set, npm-groovy-lint ignores JSON rule definitions.",
            },
        },
        anyOf: [
            {
                required: ["rules"],
            },
            {
                required: ["codenarcRulesets"],
            },
            {
                required: ["extends"],
            },
        ],
        allOf: [
            {
                if: {
                    required: ["codenarcRulesets"],
                },
                then: {
                    not: {
                        required: ["rules"],
                    },
                },
            },
        ],
    };

    const schemaPath = path.join(process.cwd(), "docs", "groovy-lint.jsonschema.json");
    await fsPromises.mkdir(path.dirname(schemaPath), { recursive: true });
    await fsPromises.writeFile(schemaPath, JSON.stringify(schema, null, 2) + "\n");
    console.log("Generated docs/groovy-lint.jsonschema.json");
}

async function getAvailableBaseConfigs() {
    const libEntries = await fsPromises.readdir("./lib");
    return libEntries
        .filter((entry) => entry.startsWith(".groovylintrc-") && entry.endsWith(".json"))
        .map((entry) => entry.replace(".groovylintrc-", "").replace(".json", ""))
        .sort();
}

function buildRuleSchema(description, ruleName, rulePropertyMetadata, severityEnum) {
    const shortName = ruleName.includes(".") ? ruleName.split(".").pop() : ruleName;
    const propertyList = rulePropertyMetadata?.[shortName] || [];
    const anyOf = [
        {
            type: "string",
            enum: severityEnum,
        },
        buildRuleObjectSchema(propertyList, severityEnum),
    ];
    const schema = { anyOf };
    if (description) {
        schema.description = description;
    }
    return schema;
}

function buildRuleObjectSchema(propertyList, severityEnum) {
    const properties = {
        severity: {
            type: "string",
            enum: severityEnum,
        },
        enabled: {
            type: "boolean",
        },
    };

    for (const prop of propertyList) {
        if (!prop?.name) {
            continue;
        }
        properties[prop.name] = mapJavaTypeToSchema(prop.type);
    }

    return {
        type: "object",
        additionalProperties: true,
        properties,
    };
}

function mapJavaTypeToSchema(javaType = "") {
    const normalized = (javaType || "").toLowerCase();
    if (!javaType) {
        return {};
    }
    if (normalized.includes("boolean")) {
        return { type: "boolean" };
    }
    if (/(byte|short|int|integer|long)/.test(normalized)) {
        return { type: "integer" };
    }
    if (/(double|float|bigdecimal|biginteger|number)/.test(normalized)) {
        return { type: "number" };
    }
    if (normalized.includes("list") || normalized.includes("set") || normalized.includes("collection")) {
        return { type: "array" };
    }
    if (normalized.includes("map") || normalized.includes("properties")) {
        return { type: "object" };
    }
    if (normalized.includes("file") || normalized.includes("path")) {
        return { type: "string", description: "Path or file value" };
    }
    if (normalized.includes("pattern") || normalized.includes("regex")) {
        return { type: "string", description: "Regular expression" };
    }
    return { type: "string" };
}

async function collectRulePropertyMetadata() {
    const jarsClasspath = gatherJarClasspath(path.resolve("./lib/java"));
    if (!jarsClasspath) {
        return {};
    }

    let resource;
    try {
        resource = await downloadCodeNarcResource("codenarc-base-rules.properties");
    } catch (error) {
        console.warn("Unable to download CodeNarc metadata", error.message);
        return {};
    }

    const scriptContent = buildRuleIntrospectionScript();
    const tempDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), "groovylint-schema-"));
    const scriptPath = path.join(tempDir, "collect-rule-props.groovy");
    await fsPromises.writeFile(scriptPath, scriptContent, "utf8");

    const javaExecutable = process.env.JAVA_HOME
        ? path.join(process.env.JAVA_HOME, "bin", process.platform === "win32" ? "java.exe" : "java")
        : "java";
    let stdout;
    try {
        stdout = execFileSync(javaExecutable, ["-cp", jarsClasspath, "groovy.ui.GroovyMain", scriptPath, resource.path], {
            encoding: "utf8",
            stdio: ["ignore", "pipe", "inherit"],
        });
    } catch (error) {
        console.warn("Unable to collect rule property metadata", error.message);
        await fsPromises.rm(tempDir, { recursive: true, force: true }).catch(() => {});
        await resource.cleanup();
        return {};
    }

    await fsPromises.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    await resource.cleanup();

    try {
        return JSON.parse(stdout || "{}");
    } catch (error) {
        console.warn("Unable to parse rule property metadata", error.message);
        return {};
    }
}

function gatherJarClasspath(rootDir) {
    if (!fs.existsSync(rootDir)) {
        return "";
    }
    const jars = [];
    const walk = (dir) => {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                walk(fullPath);
            } else if (entry.isFile() && entry.name.endsWith(".jar")) {
                jars.push(fullPath);
            }
        }
    };
    walk(rootDir);
    return jars.length ? jars.join(path.delimiter) : "";
}

function buildRuleIntrospectionScript() {
    const excludedProps = [
        "class",
        "metaClass",
        "name",
        "priority",
        "description",
        "enabled",
        "applyToFilesMatching",
        "doNotApplyToFilesMatching",
        "applyToFileNames",
        "doNotApplyToFileNames",
        "applyToClassNames",
        "doNotApplyToClassNames",
        "violationMessage",
        "compilerPhase",
        "astVisitorClass",
        "analysisContext",
        "ruleSetConfig",
        "ready",
    ];

    return `
import groovy.json.JsonOutput
import java.util.Properties
import java.beans.Introspector

if (this.args.length == 0) {
    System.err.println('Missing codenarc-base-rules.properties argument')
    System.exit(1)
}

def baseRules = new Properties()
def baseFile = new File(this.args[0])
if (!baseFile.exists()) {
    System.err.println("Base rules file not found: \${baseFile}")
    System.exit(1)
}
baseFile.withInputStream { baseRules.load(it) }

def excluded = new HashSet(${JSON.stringify(excludedProps)})
def result = [:]

baseRules.each { shortName, className ->
    try {
        def clazz = this.class.classLoader.loadClass(className.toString())
        def beanInfo = Introspector.getBeanInfo(clazz)
        def props = beanInfo.propertyDescriptors.findAll { pd ->
            pd?.writeMethod && pd?.readMethod && pd?.name && !excluded.contains(pd.name) && !pd.name.startsWith('$')
        }.collect { pd ->
            [name: pd.name, type: pd.propertyType?.name ?: 'java.lang.Object']
        }
        if (props) {
            result[shortName.toString()] = props
        }
    } catch (Throwable ignored) {
        // ignore rules that cannot be loaded (missing deps, etc.)
    }
}

println(JsonOutput.toJson(result))
`;
}

async function downloadCodeNarcResource(filename) {
    const fetchFn = globalThis.fetch;
    if (typeof fetchFn !== "function") {
        throw new Error("Global fetch API is not available in this Node.js runtime.");
    }
    const url = `${CODENARC_RESOURCES_BASE_URL}/${filename}`;
    const tmpDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), "groovylint-codenarc-"));
    const tmpPath = path.join(tmpDir, filename);
    const response = await fetchFn(url);
    if (!response.ok) {
        await fsPromises.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
        throw new Error(`Unable to download ${filename} (${response.status})`);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    await fsPromises.writeFile(tmpPath, buffer);
    return {
        path: tmpPath,
        cleanup: async () => {
            await fsPromises.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
        },
    };
}
