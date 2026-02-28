import { strict as assert } from "assert";
import fs from "fs-extra";
import os from "os";
import path from "path";
import { describe, beforeEach, afterEach, it } from "mocha";
import { loadConfig } from "../lib/config.js";

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
            await fs.remove(tempDir);
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
});
