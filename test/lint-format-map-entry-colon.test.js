#! /usr/bin/env node
// SpaceAroundMapEntryColon has no fixer, and CodeNarc's default flags `[key: value]`.
// v19 dropped the "off" that v18's default preset carried, so --format reported every map
// literal and exited 1 (nvuillam/npm-groovy-lint#622).
import NpmGroovyLint from "../lib/groovy-lint.js";
import assert from "assert";
import fs from "node:fs";
import * as os from "os";
import * as path from "path";
import { beforeEachTestCase } from "./helpers/common.js";

const MAP_WITH_SPACES = "Map m = [image: 'foo', credentialsId: 'bar']\nprintln m\n";

describe("SpaceAroundMapEntryColon (#622)", function () {
    beforeEach(beforeEachTestCase);

    it("(API:format) --format does not report `key: value` map entries with the recommended preset", async function () {
        this.timeout(300000);
        const tmpDir = writeProject({ extends: "recommended" }, MAP_WITH_SPACES);
        try {
            const linter = await run(tmpDir, { format: true });
            assert(linter.status === 0, `Linter status is 0 (${linter.status} returned)`);
            assert.deepStrictEqual(mapColonErrors(linter), [], "Expected no SpaceAroundMapEntryColon error under --format");
        } finally {
            fs.rmSync(tmpDir, { recursive: true, force: true });
        }
    });

    it("(API:format) --format still applies SpaceAroundMapEntryColon when the user config enables it", async function () {
        this.timeout(300000);
        const tmpDir = writeProject({ extends: "recommended", rules: { SpaceAroundMapEntryColon: {} } }, MAP_WITH_SPACES);
        try {
            const linter = await run(tmpDir, { format: true });
            assert(linter.status === 1, `Linter status is 1 (${linter.status} returned)`);
            assert(mapColonErrors(linter).length === 2, `Expected 2 SpaceAroundMapEntryColon errors, got ${mapColonErrors(linter).length}`);
        } finally {
            fs.rmSync(tmpDir, { recursive: true, force: true });
        }
    });

    it("(API:lint) the advanced preset accepts `key: value` and reports `key:value`", async function () {
        this.timeout(300000);
        const tmpDir = writeProject({ extends: "advanced" }, "Map m = [image: 'foo', credentialsId:'bar']\nprintln m\n");
        try {
            const linter = await run(tmpDir, { failon: "none" });
            const errors = mapColonErrors(linter);
            assert(errors.length === 1, `Expected 1 SpaceAroundMapEntryColon error, got ${errors.length}`);
            assert(errors[0].msg.includes("credentialsId"), `Expected the error on credentialsId, got: ${errors[0].msg}`);
        } finally {
            fs.rmSync(tmpDir, { recursive: true, force: true });
        }
    });
});

function writeProject(config, groovySource) {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ngl-map-colon-"));
    fs.writeFileSync(path.join(tmpDir, ".groovylintrc.json"), JSON.stringify(config));
    fs.writeFileSync(path.join(tmpDir, "MapColon.groovy"), groovySource);
    return tmpDir;
}

async function run(tmpDir, options) {
    return await new NpmGroovyLint(
        { path: tmpDir, config: path.join(tmpDir, ".groovylintrc.json"), insight: false, failon: "info", output: "none", ...options },
        {},
    ).run();
}

function mapColonErrors(linter) {
    return Object.values(linter.lintResult.files || {})
        .flatMap((file) => file.errors || [])
        .filter((error) => error.rule === "SpaceAroundMapEntryColon");
}
