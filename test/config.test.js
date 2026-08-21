import { strict as assert } from "assert";
import fs from "node:fs/promises";
import os from "os";
import path from "path";
import { describe, beforeEach, afterEach, it } from "mocha";
import { loadConfig } from "../lib/config.js";
import NpmGroovyLint from "../lib/groovy-lint.js";

// Validate that loadConfig reloads JS configs via import-fresh instead of a cached module
describe("config import-fresh behavior", () => {
    const tempRoot = path.join(os.tmpdir(), "ngl-config-js-");
    let tempDir;
    let configPath;

    beforeEach(async () => {
        tempDir = await fs.mkdtemp(tempRoot);
        configPath = path.join(tempDir, ".groovylintrc.cjs");
    });

    afterEach(async () => {
        if (tempDir) {
            await fs.rm(tempDir, { recursive: true, force: true });
        }
    });

    it("reloads updated JS config without cache", async () => {
        const initialConfig = `module.exports = { customFlag: 1, rules: { DummyRule: { enabled: true } } };`;
        const updatedConfig = `module.exports = { customFlag: 2, rules: { DummyRule: { enabled: false } } };`;

        await fs.writeFile(configPath, initialConfig);
        const firstLoad = await loadConfig(tempDir);
        assert.equal(firstLoad.customFlag, 1);
        assert.equal(firstLoad.rules.DummyRule.enabled, true);

        await fs.writeFile(configPath, updatedConfig);
        const secondLoad = await loadConfig(tempDir);
        assert.equal(secondLoad.customFlag, 2);
        assert.equal(secondLoad.rules.DummyRule.enabled, false);
    });

    it("reloads a local module required by a CommonJS config", async () => {
        await fs.writeFile(configPath, `module.exports = require("./groovylint-base.cjs");`);
        const basePath = path.join(tempDir, "groovylint-base.cjs");

        await fs.writeFile(basePath, `module.exports = { customFlag: 1, rules: {} };`);
        assert.equal((await loadConfig(tempDir)).customFlag, 1);

        await fs.writeFile(basePath, `module.exports = { customFlag: 2, rules: {} };`);
        assert.equal((await loadConfig(tempDir)).customFlag, 2, "Change in a required local module must be picked up");
    });

    it("does not re-execute an installed package required by a CommonJS config", async () => {
        // Evicting node_modules from the require cache would duplicate their singletons on every load
        const packageDir = path.join(tempDir, "node_modules", "fake-pkg");
        await fs.mkdir(packageDir, { recursive: true });
        const runsFile = path.join(tempDir, "runs.txt");
        await fs.writeFile(runsFile, "");
        await fs.writeFile(path.join(packageDir, "package.json"), JSON.stringify({ name: "fake-pkg", main: "index.js" }));
        await fs.writeFile(
            path.join(packageDir, "index.js"),
            `require("fs").appendFileSync(${JSON.stringify(runsFile.replace(/\\/g, "/"))}, "x");\nmodule.exports = {};`,
        );
        await fs.writeFile(configPath, `require("fake-pkg");\nmodule.exports = { customFlag: 1, rules: {} };`);

        await loadConfig(tempDir);
        await loadConfig(tempDir);
        const executions = (await fs.readFile(runsFile, "utf8")).length;
        assert.equal(executions, 1, `Installed package must stay cached, it was executed ${executions} times`);
    });
});

// Validate that every supported module shape of a JS config file is loaded correctly on first load
describe("config JS module shapes", () => {
    let tempDir;

    beforeEach(async () => {
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ngl-config-shapes-"));
    });

    afterEach(async () => {
        if (tempDir) {
            await fs.rm(tempDir, { recursive: true, force: true });
        }
    });

    const shapes = [
        {
            label: "ES module default export in a CommonJS package",
            packageJson: { name: "ngl-test" },
            fileName: ".groovylintrc.js",
            content: `export default { customFlag: 3, rules: { DummyRule: { enabled: false } } };`,
        },
        {
            label: "ES module named exports in a CommonJS package",
            packageJson: { name: "ngl-test" },
            fileName: ".groovylintrc.js",
            content: `export const customFlag = 3;\nexport const rules = { DummyRule: { enabled: false } };`,
        },
        {
            label: "ES module default export in a module package",
            packageJson: { name: "ngl-test", type: "module" },
            fileName: ".groovylintrc.js",
            content: `export default { customFlag: 3, rules: { DummyRule: { enabled: false } } };`,
        },
        {
            label: "ES module named exports in a module package",
            packageJson: { name: "ngl-test", type: "module" },
            fileName: ".groovylintrc.js",
            content: `export const customFlag = 3;\nexport const rules = { DummyRule: { enabled: false } };`,
        },
        {
            label: "CommonJS module.exports",
            packageJson: { name: "ngl-test" },
            fileName: ".groovylintrc.cjs",
            content: `module.exports = { customFlag: 3, rules: { DummyRule: { enabled: false } } };`,
        },
    ];

    for (const shape of shapes) {
        it(`loads a config declared as ${shape.label}`, async () => {
            await fs.writeFile(path.join(tempDir, "package.json"), JSON.stringify(shape.packageJson));
            await fs.writeFile(path.join(tempDir, shape.fileName), shape.content);

            const config = await loadConfig(tempDir);
            assert.equal(config.customFlag, 3);
            assert.equal(config.rules.DummyRule.enabled, false, "Rules defined by the user must not be lost");
        });
    }

    it("reloads an ES module config when its content changes, and reuses it when it does not", async () => {
        await fs.writeFile(path.join(tempDir, "package.json"), JSON.stringify({ name: "ngl-test", type: "module" }));
        const configPath = path.join(tempDir, ".groovylintrc.js");

        await fs.writeFile(configPath, `export default { customFlag: 1, rules: {} };`);
        assert.equal((await loadConfig(tempDir)).customFlag, 1);
        assert.equal((await loadConfig(tempDir)).customFlag, 1, "Unchanged config must still resolve to the same values");

        await fs.writeFile(configPath, `export default { customFlag: 2, rules: {} };`);
        assert.equal((await loadConfig(tempDir)).customFlag, 2, "Updated ES module config must be reloaded");
    });
});

// Validate the inlined replacement of the strip-json-comments package
describe("config JSON comments", () => {
    let tempDir;

    beforeEach(async () => {
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ngl-config-json-"));
    });

    afterEach(async () => {
        if (tempDir) {
            await fs.rm(tempDir, { recursive: true, force: true });
        }
    });

    const writeConfig = async (content) => {
        await fs.writeFile(path.join(tempDir, ".groovylintrc.json"), content);
    };

    it("ignores line and block comments", async () => {
        await writeConfig(`{\n  // line comment\n  "customFlag": 3, /* block comment */\n  "rules": {}\n}`);
        assert.equal((await loadConfig(tempDir)).customFlag, 3);
    });

    it("keeps comment markers that appear inside strings", async () => {
        await writeConfig(`{ "customFlag": "http://example.com /* keep */ // keep", "rules": {} }`);
        assert.equal((await loadConfig(tempDir)).customFlag, "http://example.com /* keep */ // keep");
    });

    it("rejects a file truncated inside a block comment", async () => {
        // Blanking out the rest of the file would accept a config truncated mid-write as valid
        await writeConfig(`{ "customFlag": 3, "rules": {} } /* truncated`);
        await assert.rejects(() => loadConfig(tempDir), /Cannot read config file/);
    });
});

describe("ruleset presets", () => {
    const readPreset = async (name) => JSON.parse(await fs.readFile(`./lib/.groovylintrc-${name}.json`, "utf8"));
    const categoriesOf = (preset) => new Set(Object.keys(preset.rules).map((ruleName) => ruleName.split(".")[0]));
    const shortNames = (preset) => new Set(Object.keys(preset.rules).map((ruleName) => ruleName.split(".").pop()));

    it("(CFG) recommended is an explicit rule list, not extends:all", async function () {
        const recommended = await readPreset("recommended");
        // Guards the root cause of the original 386-rule default: under `extends: all`,
        // every rule a future CodeNarc release adds joins recommended silently.
        assert(recommended.extends === undefined, `recommended must not extend another preset (extends: ${recommended.extends})`);
        const ruleCount = Object.keys(recommended.rules).length;
        assert(ruleCount > 100 && ruleCount < 220, `recommended should hold ~149 defect rules, found ${ruleCount}`);
        assert(
            Object.keys(recommended.rules).every((ruleName) => ruleName.includes(".")),
            "every recommended rule must be listed as category.RuleName",
        );
    });

    it("(CFG) recommended keeps the defect categories whole", async function () {
        const recommended = await readPreset("recommended");
        const all = await readPreset("all");
        // These categories describe mistakes rather than preferences, so they are kept entire,
        // including the rules that rarely fire.
        for (const category of ["basic", "concurrency", "exceptions", "security", "serialization", "unused"]) {
            const inAll = Object.keys(all.rules).filter((ruleName) => ruleName.startsWith(`${category}.`));
            const missing = inAll.filter((ruleName) => recommended.rules[ruleName] === undefined);
            assert(inAll.length > 0, `category ${category} not found in the all preset`);
            assert.deepEqual(missing, [], `every ${category} rule must be in recommended`);
        }
    });

    it("(CFG) recommended reports likely mistakes only, never layout", async function () {
        const recommended = await readPreset("recommended");
        const format = await readPreset("format");
        const advanced = await readPreset("advanced");
        // Layout belongs to the `format` preset, which --format and --fix apply on top of the
        // lint ruleset, so `npm-groovy-lint --fix` still repairs it.
        const layoutCategories = ["formatting", "braces"];
        for (const category of layoutCategories) {
            assert(!categoriesOf(recommended).has(category), `recommended must not carry ${category} rules`);
            assert(categoriesOf(advanced).has(category), `advanced must carry ${category} rules`);
        }
        const inFormat = shortNames(format);
        for (const ruleName of ["Indentation", "SpaceAroundOperator", "SpaceBeforeOpeningBrace", "ConsecutiveBlankLines"]) {
            assert(inFormat.has(ruleName), `${ruleName} must stay in the format preset so --format and --fix still repair layout`);
        }
    });

    it("(CFG) each tier is a superset of the previous one", async function () {
        const [recommended, advanced, all] = await Promise.all([readPreset("recommended"), readPreset("advanced"), readPreset("all")]);
        const notInAdvanced = Object.keys(recommended.rules).filter((ruleName) => advanced.rules[ruleName] === undefined);
        assert.deepEqual(notInAdvanced, [], "advanced must contain every recommended rule");
        const notInAll = Object.keys(advanced.rules).filter((ruleName) => all.rules[ruleName] === undefined);
        assert.deepEqual(notInAll, [], "all must contain every advanced rule");
        assert(
            Object.keys(advanced.rules).length > Object.keys(recommended.rules).length,
            "advanced must add rules on top of recommended",
        );
    });

    it("(CFG) framework and inert rules stay out of the framework-agnostic tiers", async function () {
        const [recommended, advanced, grails, tests] = await Promise.all([
            readPreset("recommended"),
            readPreset("advanced"),
            readPreset("grails"),
            readPreset("tests"),
        ]);
        for (const preset of [recommended, advanced]) {
            for (const category of ["grails", "junit", "generic"]) {
                assert(!categoriesOf(preset).has(category), `${category} rules must be opt-in, not part of a default tier`);
            }
        }
        assert(shortNames(grails).has("GrailsMassAssignment"), "the grails preset must carry the grails rules");
        assert(shortNames(tests).has("JUnitTestMethodWithoutAssert"), "the tests preset must carry the junit rules");
        // The enhanced rules need CodeNarc compilation phase 4, which roughly doubles a run:
        // available in advanced and tests, never in the default.
        assert(shortNames(advanced).has("UnsafeImplementationAsMap"), "advanced must carry the enhanced rules");
        assert(shortNames(tests).has("JUnitAssertEqualsConstantActualValue"), "tests must carry the enhanced JUnit rule");
        assert(!shortNames(recommended).has("UnsafeImplementationAsMap"), "recommended must not carry the phase-4 rules");
    });

    it("(CFG) extends accepts a list of presets merged left to right", async function () {
        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ngl-config-extends-"));
        try {
            const configFilePath = path.join(tempDir, ".groovylintrc.json");
            await fs.writeFile(
                configFilePath,
                JSON.stringify({ extends: ["recommended", "grails", "tests"], rules: { "basic.DeadCode": "off" } }),
            );
            const config = await loadConfig(configFilePath);
            assert(config.rules.EmptyCatchBlock !== undefined, "rules of the first base must be kept");
            assert(config.rules.GrailsMassAssignment !== undefined, "rules of the grails add-on must be merged in");
            assert(config.rules.JUnitTestMethodWithoutAssert !== undefined, "rules of the tests add-on must be merged in");
            assert.equal(config.rules.DeadCode, "off", "the config's own rules must win over every base");
            assert.equal(config.extends, undefined, "extends must be resolved away");
        } finally {
            await fs.rm(tempDir, { recursive: true, force: true });
        }
    });

    it("(CFG) recommended-jenkinsfile composes recommended with the jenkinsfile add-on", async function () {
        const linter = new NpmGroovyLint([process.execPath, "", "--no-insight"], { parseOptions: true });
        const config = await linter.loadConfig("recommended-jenkinsfile");
        // Single-quoted '${env.FOO}' is deliberate in a pipeline: the shell interpolates it
        assert.equal(config.rules.GStringExpressionWithinString, "off");
        assert.equal(config.rules.NoDef, "off");
        assert.deepEqual(config.rules.UnusedVariable, { ignoreVariableNames: "_" });
        assert(config.rules.EmptyCatchBlock !== undefined, "the jenkinsfile preset must still carry the recommended rules");
    });
});
