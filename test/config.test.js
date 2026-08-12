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

describe("recommended preset rules", () => {
    it("(CFG) recommended excludes the phase-4 rules that cannot resolve classes", async function () {
        const linter = new NpmGroovyLint([process.execPath, "", "--no-insight"], { parseOptions: true });
        const config = await linter.loadConfig("recommended");
        const deadRules = [
            "CloneWithoutCloneable",
            "JUnitAssertEqualsConstantActualValue",
            "MissingOverrideAnnotation",
            "UnsafeImplementationAsMap",
            "GrailsDomainGormMethods",
        ];
        // recommended is now an explicit keep-list rather than `extends: all` plus
        // overrides, so a disabled rule is simply absent instead of set to "off".
        for (const ruleName of deadRules) {
            assert(config.rules[ruleName] === undefined, `${ruleName} should be absent from recommended (was ${JSON.stringify(config.rules[ruleName])})`);
        }
    });

    it("(CFG) recommended is an explicit rule list, not extends:all", async function () {
        const recommended = JSON.parse(await fs.readFile("./lib/.groovylintrc-recommended.json", "utf8"));
        // Guards the root cause of the original 386-rule default: under `extends: all`,
        // every rule a future CodeNarc release adds joins recommended silently.
        assert(recommended.extends === undefined, `recommended must not extend another preset (extends: ${recommended.extends})`);
        const ruleCount = Object.keys(recommended.rules).length;
        assert(ruleCount > 200 && ruleCount < 300, `recommended should hold ~244 curated rules, found ${ruleCount}`);
        assert(
            Object.keys(recommended.rules).every((ruleName) => ruleName.includes(".")),
            "every recommended rule must be listed as category.RuleName",
        );
    });

    it("(CFG) recommended excludes the Space* rules, which remain in the format preset", async function () {
        const recommended = JSON.parse(await fs.readFile("./lib/.groovylintrc-recommended.json", "utf8"));
        const format = JSON.parse(await fs.readFile("./lib/.groovylintrc-format.json", "utf8"));
        // These 13 rules measured ~45% of a lint run while reporting very little, so
        // spacing is handled by --format. See docs/superpowers/specs/2026-08-12-ruleset-curation.md
        const spaceRules = [
            "SpaceAfterCatch",
            "SpaceAfterComma",
            "SpaceAfterFor",
            "SpaceAfterIf",
            "SpaceAfterMethodCallName",
            "SpaceAfterOpeningBrace",
            "SpaceAfterSemicolon",
            "SpaceAfterSwitch",
            "SpaceAfterWhile",
            "SpaceAroundOperator",
            "SpaceBeforeClosingBrace",
            "SpaceBeforeOpeningBrace",
            "SpaceInsideParentheses",
        ];
        const shortNames = (config) => new Set(Object.keys(config.rules).map((ruleName) => ruleName.split(".").pop()));
        const inRecommended = shortNames(recommended);
        const inFormat = shortNames(format);
        for (const ruleName of spaceRules) {
            assert(!inRecommended.has(ruleName), `${ruleName} should not be in recommended`);
            assert(inFormat.has(ruleName), `${ruleName} must stay in the format preset so --format still fixes spacing`);
        }
        // Indentation is cheap and high-yield, so it stays in the default.
        assert(inRecommended.has("Indentation"), "Indentation must stay in recommended so --fix still repairs layout");
    });
});
