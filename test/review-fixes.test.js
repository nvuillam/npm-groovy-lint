#! /usr/bin/env node
// Regression tests for the fixes applied after the code review of the performance branch:
// --codenarcargs honoring -basedir through the server, report handling (colon-less -report,
// non-JSON stdout reports), cache soundness with classpath-dependent rules, --fix not
// reporting borrowed layout rules, semantic parse errors, add-on presets extending
// recommended, stale-server detection, and the /kill endpoint authorization token
// (nvuillam/npm-groovy-lint#607).
import NpmGroovyLint from "../lib/groovy-lint.js";
import { isStaleServerResponse } from "../lib/codenarc-caller.js";
import { loadConfig } from "../lib/config.js";
import { optionsDefinition } from "../lib/options.js";
import assert from "assert";
import fs from "node:fs";
import * as os from "os";
import * as path from "path";
import { beforeEachTestCase, copyFilesInTmpDir, SAMPLE_FILE_SMALL } from "./helpers/common.js";

// Extract the totalFiles attribute of a CodeNarc XML report (single or double quotes)
function xmlReportTotalFiles(xmlContent) {
    const match = /totalFiles=['"](\d+)['"]/.exec(xmlContent);
    return match ? parseInt(match[1], 10) : null;
}

describe("Review fixes", function () {
    it("(REVIEW:codenarcargs) -basedir inside --codenarcargs produces a non-empty XML report through the server", async function () {
        beforeEachTestCase();
        const reportFileName = path.resolve("./tmp/ReportCodenarcArgsBasedir.xml");
        fs.rmSync(reportFileName, { force: true });
        const linter = await new NpmGroovyLint(
            [
                process.execPath,
                "",
                "--codenarcargs",
                `-basedir=${path.resolve("lib/example")}`,
                "-title=ReviewFixBasedir",
                "-maxPriority1Violations=0",
                `-report=xml:${reportFileName}`,
            ],
            {},
        ).run();
        assert(linter.status === 0, `Linter status is 0 (${linter.status} returned)`);
        assert(fs.existsSync(reportFileName), `XML report generated at ${reportFileName}`);
        const reportContent = fs.readFileSync(reportFileName, "utf8");
        const totalFiles = xmlReportTotalFiles(reportContent);
        // Before the fix, the server ignored the -basedir carried inside codeNarcArgs and
        // rebuilt -includes from its own working directory, so the report existed but was
        // empty (totalFiles=0): the existence assertion alone let the bug through.
        assert(totalFiles > 0, `Expected the report to cover the files of lib/example, got totalFiles=${totalFiles}\n${reportContent}`);
        fs.rmSync(reportFileName, { force: true });
    });

    it("(REVIEW:codenarcargs) -report=xml:stdout returns the XML report on stdout", async function () {
        beforeEachTestCase();
        const linter = await new NpmGroovyLint(
            [process.execPath, "", "--codenarcargs", `-basedir=${path.resolve("lib/example")}`, "-report=xml:stdout"],
            {},
        ).run();
        assert(linter.status === 0, `Linter status is 0 (${linter.status} returned)`);
        // Before the fix, a multi-file corpus was split into partitions and only their JSON
        // reports were collected, so the captured XML was discarded and stdout stayed empty.
        assert(
            linter.codeNarcStdOut && linter.codeNarcStdOut.includes("<CodeNarc"),
            `Expected the XML report on stdout, got: ${JSON.stringify(linter.codeNarcStdOut)}`,
        );
        const totalFiles = xmlReportTotalFiles(linter.codeNarcStdOut);
        assert(totalFiles > 0, `Expected the stdout XML report to cover the analysed files, got totalFiles=${totalFiles}`);
    });

    it("(REVIEW:codenarcargs) a colon-less -report=xml still writes the default report file when results are cached", async function () {
        beforeEachTestCase();
        // CodeNarc writes its default report file (CodeNarcXmlReport.xml) in the working
        // directory of the server process, which the test suite starts from the repository
        // root. If a server started elsewhere is being reused, the file lands out of reach:
        // skip instead of failing on an unrelated setup difference.
        const defaultReportPath = path.resolve("CodeNarcXmlReport.xml");
        const runIt = async () =>
            await new NpmGroovyLint(
                [process.execPath, "", "--codenarcargs", `-basedir=${path.resolve("lib/example")}`, "-report=xml"],
                {},
            ).run();

        const first = await runIt();
        assert(first.status === 0, `First run status is 0 (${first.status} returned)`);
        if (!fs.existsSync(defaultReportPath)) {
            console.log("Default report file not found at the expected location (server started from another cwd): skipping");
            this.skip();
            return;
        }
        fs.rmSync(defaultReportPath, { force: true });

        // Before the fix, a colon-less -report was classified as "not a file report", so this
        // second, identical run was served entirely from the cache, CodeNarc never executed,
        // and the report file was never rewritten.
        const second = await runIt();
        assert(second.status === 0, `Second run status is 0 (${second.status} returned)`);
        assert(fs.existsSync(defaultReportPath), "Expected the default XML report to be rewritten on a warm cache");
        const totalFiles = xmlReportTotalFiles(fs.readFileSync(defaultReportPath, "utf8"));
        assert(totalFiles > 0, `Expected the rewritten report to cover the analysed files, got totalFiles=${totalFiles}`);
        fs.rmSync(defaultReportPath, { force: true });
    });

    it("(REVIEW:cache) a classpath-dependent rule prevents cross-project cache hits", async function () {
        this.timeout(300000);
        beforeEachTestCase();
        // Two directories holding the exact same file at the same relative path, linted with
        // a phase-4 (classpath-dependent) rule enabled: their results may legitimately
        // differ (such rules resolve classes relative to the real base directory), so the
        // second directory must NOT be served the first one's cached results.
        const dirA = await copyFilesInTmpDir();
        const dirB = await copyFilesInTmpDir();
        const lint = async (dir) =>
            await new NpmGroovyLint(
                {
                    path: dir,
                    files: "**/SampleFileSmall.groovy",
                    rulesets: "UnsafeImplementationAsMap",
                    insight: false,
                    failon: "none",
                    output: "none",
                },
                {},
            ).run();

        const runA = await lint(dirA);
        assert(runA.status === 0, `Run A status is 0 (${runA.status} returned)`);
        assert(typeof runA.cacheHits === "number", "Expected cache statistics on the response (server run with cache enabled)");
        const runB = await lint(dirB);
        assert(runB.status === 0, `Run B status is 0 (${runB.status} returned)`);
        // cacheHits/cacheMisses are cumulative for the server process: compare deltas.
        const hitsDelta = runB.cacheHits - runA.cacheHits;
        assert(
            hitsDelta === 0,
            `Expected no cross-project cache hit with a classpath-dependent rule enabled, got ${hitsDelta} hit(s): ` +
                "an identical file in a different basedir was served another project's cached results",
        );
    });

    it("(REVIEW:fix) --fix does not report layout violations it cannot fix", async function () {
        this.timeout(300000);
        beforeEachTestCase();
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ngl-fix-borrowed-"));
        const file = path.join(tmpDir, "MapColon.groovy");
        // [key:1] violates SpaceAroundMapEntryColon (a format-preset rule with NO fixer);
        // the trailing spaces violate TrailingWhitespace (a format-preset rule WITH a fixer).
        fs.writeFileSync(file, "Map buildMap() {\n    return [key:1]   \n}\n");

        // A plain lint with the same configuration reports nothing: the recommended preset
        // carries no layout rule.
        const plain = await new NpmGroovyLint({ path: tmpDir, insight: false, failon: "info", output: "none" }, {}).run();
        assert(plain.status === 0, `Plain lint status is 0 (${plain.status} returned)`);

        // --fix borrows the format rules: it must repair what it can (trailing whitespace)
        // and stay silent about what it cannot (map entry colon spacing), instead of
        // exiting 1 on a violation the plain lint above did not even report.
        const fix = await new NpmGroovyLint({ path: tmpDir, fix: true, insight: false, failon: "info", output: "none" }, {}).run();
        assert(fix.status === 0, `--fix status is 0 (${fix.status} returned)`);
        const fixedContent = fs.readFileSync(file, "utf8");
        assert(!/[ \t]+\n/.test(fixedContent), `Expected --fix to remove the trailing whitespace, got: ${JSON.stringify(fixedContent)}`);
        const errors = Object.values(fix.lintResult.files || {}).flatMap((f) => f.errors || []);
        assert(
            !errors.some((e) => e.rule === "SpaceAroundMapEntryColon"),
            "Expected no SpaceAroundMapEntryColon error: --fix has no fixer for it, so it must not be borrowed nor reported",
        );
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it("(REVIEW:parse) semantic compilation errors are reported as parse errors", async function () {
        beforeEachTestCase();
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ngl-semantic-"));
        // A duplicate local variable is only detected at the SEMANTIC_ANALYSIS compilation
        // phase: compiling to CONVERSION only (as the parser rewrite first did) misses it.
        fs.writeFileSync(path.join(tmpDir, "DuplicateVariable.groovy"), "def duplicated = 1\ndef duplicated = 2\nprintln duplicated\n");
        const linter = await new NpmGroovyLint({ path: tmpDir, insight: false, failon: "none", output: "none" }, {}).run();
        assert(linter.status === 0, `Linter status is 0 (${linter.status} returned)`);
        const errors = Object.values(linter.lintResult.files || {}).flatMap((f) => f.errors || []);
        const parseErrors = errors.filter((e) => e.rule === "NglParseError");
        assert(
            parseErrors.some((e) => String(e.msg).includes("current scope already contains a variable")),
            `Expected an NglParseError about the duplicate variable, got: ${JSON.stringify(errors, null, 2)}`,
        );
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it("(REVIEW:config) the jenkinsfile add-on preset extends recommended, so standalone -c jenkinsfile is a full lint", async function () {
        const config = await loadConfig("jenkinsfile", "lint", null, []);
        const rules = config.rules || {};
        const enabledRules = Object.entries(rules).filter(([, def]) => def !== "off");
        assert(
            enabledRules.length > 100,
            `Expected the standalone jenkinsfile preset to carry the recommended rules, got only ${enabledRules.length} enabled rule(s)`,
        );
        // The add-on's own overrides must still win over the base.
        assert(rules["CompileStatic"] === "off", `Expected CompileStatic to stay off, got ${JSON.stringify(rules["CompileStatic"])}`);
        assert(
            rules["UnusedVariable"] && rules["UnusedVariable"].ignoreVariableNames === "_",
            `Expected the jenkinsfile UnusedVariable override, got ${JSON.stringify(rules["UnusedVariable"])}`,
        );
    });

    it("(REVIEW:config) the grails and tests add-on presets extend recommended too", async function () {
        for (const preset of ["grails", "tests"]) {
            const config = await loadConfig(preset, "lint", null, []);
            const ruleCount = Object.keys(config.rules || {}).length;
            assert(ruleCount > 100, `Expected the standalone ${preset} preset to carry the recommended rules, got ${ruleCount} rule(s)`);
        }
    });

    it("(REVIEW:server) a stale-server response is recognized so the server gets restarted instead of falling back to cold JVM calls", function () {
        assert(
            isStaleServerResponse({
                exceptionType: "com.fasterxml.jackson.databind.exc.UnrecognizedPropertyException",
                errorMessage: 'Unrecognized field "parallelism" (class com.nvuillam.Request), not marked as ignorable',
            }),
            "An UnrecognizedPropertyException 500 must be classified as a stale server",
        );
        assert(
            isStaleServerResponse({ errorMessage: 'Unrecognized field "newField"' }),
            "An 'Unrecognized field' message must be classified as a stale server even without the exception type",
        );
        assert(
            !isStaleServerResponse({ exceptionType: "java.io.FileNotFoundException", errorMessage: "some/dir" }),
            "An ordinary server error must not be classified as a stale server",
        );
        assert(!isStaleServerResponse({}), "An empty error payload must not be classified as a stale server");
        assert(!isStaleServerResponse(undefined), "A missing payload must not be classified as a stale server");
    });

    // The two tests below run last in this file on purpose: the second one kills the shared
    // CodeNarc server (the next lint of the suite transparently restarts it).
    it("(REVIEW:security) /kill without the authorization token is rejected and the server keeps running", async function () {
        this.timeout(300000);
        beforeEachTestCase();
        // Ensure a server is running.
        const linter = await new NpmGroovyLint(
            { path: "./lib/example/", files: "**/" + SAMPLE_FILE_SMALL, insight: false, failon: "none", output: "none" },
            {},
        ).run();
        assert(linter.status === 0, `Linter status is 0 (${linter.status} returned)`);

        const serverOptions = optionsDefinition.parse({});
        const serverUri = serverOptions.serverhost + ":" + serverOptions.serverport;
        // Before the fix, ANY local process could shut the server down with this bare request.
        const killResponse = await fetch(serverUri + "/kill", { method: "POST", signal: AbortSignal.timeout(10000) });
        assert(killResponse.status === 401, `Expected a token-less /kill to be rejected with 401, got ${killResponse.status}`);
        const killBody = await killResponse.json();
        assert(killBody.status === "unauthorized", `Expected an unauthorized status in the response, got ${JSON.stringify(killBody)}`);

        const pingResponse = await fetch(serverUri + "/ping", { signal: AbortSignal.timeout(10000) });
        pingResponse.body?.cancel().catch(() => {});
        assert(pingResponse.status === 200, "Expected the server to still be running after the rejected kill request");
    });

    it("(REVIEW:security) --killserver reads the persisted token and terminates the server", async function () {
        this.timeout(300000);
        beforeEachTestCase();
        // Ensure a server is running.
        const linter = await new NpmGroovyLint(
            { path: "./lib/example/", files: "**/" + SAMPLE_FILE_SMALL, insight: false, failon: "none", output: "none" },
            {},
        ).run();
        assert(linter.status === 0, `Linter status is 0 (${linter.status} returned)`);

        // The server must have persisted its kill token where sibling processes look it up.
        const serverOptions = optionsDefinition.parse({});
        const tokenFilePath = path.join(os.tmpdir(), `npm-groovy-lint-server-kill-${serverOptions.serverport}.token`);
        assert(fs.existsSync(tokenFilePath), `Expected the kill token to be persisted at ${tokenFilePath}`);

        // A fresh process-like invocation (it did not start the server, so it cannot kill it by
        // PID) must be able to authorize its kill request through the persisted token.
        const killer = await new NpmGroovyLint([process.execPath, "", "--killserver", "--no-insight"], {}).run();
        assert(killer.status === 0, `--killserver status is 0 (${killer.status} returned)`);
        assert(
            killer.outputString.includes("CodeNarcServer terminated"),
            `Expected the server to be terminated through the token-authorized kill, got: ${killer.outputString}`,
        );
    });
});

// Regression tests for the second review round of the performance branch.
describe("Review fixes (round 2)", function () {
    it("(REVIEW2:report) a file-destination report is still written when no file matches", async function () {
        this.timeout(300000);
        beforeEachTestCase();
        const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), "ngl-empty-"));
        const reportFile = path.join(emptyDir, "report.xml");
        // No .groovy file in the directory: the default '**/*.groovy' includes match nothing.
        // CodeNarc must still execute once so the (empty) report file is produced - a CI step
        // reading it would otherwise fail on a missing file.
        const linter = await new NpmGroovyLint(
            [process.execPath, "", "--codenarcargs", `-basedir=${emptyDir}`, `-report=xml:${reportFile}`],
            {},
        ).run();
        assert(linter.status === 0, `Linter status is 0 (${linter.status} returned)`);
        assert(fs.existsSync(reportFile), "Expected the empty XML report file to be written even though no file matched");
        const totalFiles = xmlReportTotalFiles(fs.readFileSync(reportFile, "utf8"));
        assert(totalFiles === 0, `Expected an empty report (totalFiles=0), got ${totalFiles}`);
        fs.rmSync(emptyDir, { recursive: true, force: true });
    });

    it("(REVIEW2:config) extending a built-in preset does not clobber the user's overriddenRules", async function () {
        const userDir = fs.mkdtempSync(path.join(os.tmpdir(), "ngl-overrides-"));
        fs.writeFileSync(path.join(userDir, ".groovylintrc.json"), JSON.stringify({ extends: "advanced", rules: { Indentation: "off" } }));
        const config = await loadConfig(userDir, "lint", null, []);
        // The merged ruleset must carry the advanced preset...
        assert(Object.keys(config.rules).length > 300, `Expected the advanced ruleset to be merged, got ${Object.keys(config.rules).length}`);
        assert(config.rules["Indentation"] === "off", "The user's own override must win over the preset");
        // ...but overriddenRules must list ONLY what the user explicitly configured, not the
        // preset's full rule map (loading the preset as an extends base used to clobber it).
        assert(
            config.overriddenRules && Object.keys(config.overriddenRules).length === 1 && config.overriddenRules["Indentation"] === "off",
            `Expected overriddenRules to hold exactly the user's single override, got: ${JSON.stringify(Object.keys(config.overriddenRules || {}))}`,
        );
        fs.rmSync(userDir, { recursive: true, force: true });
    });

    it("(REVIEW2:parallelism) --noserver honors an explicit --parallelism 1", async function () {
        this.timeout(300000);
        beforeEachTestCase();
        // Several files + multi-core CI runners: without the fix, the direct java path had no
        // way to carry the requested parallelism and partitioned anyway.
        const linter = await new NpmGroovyLint(
            {
                path: "./lib/example/",
                files: "**/*.groovy",
                noserver: true,
                parallelism: 1,
                insight: false,
                failon: "none",
                output: "none",
            },
            {},
        ).run();
        assert(linter.status === 0, `Linter status is 0 (${linter.status} returned)`);
        assert.strictEqual(
            linter.partitionCount,
            1,
            `Expected --noserver --parallelism 1 to run a single partition, got ${linter.partitionCount}`,
        );
    });

    it("(REVIEW2:fix) fixErrors() keeps a failure status raised by remaining non-borrowed violations", async function () {
        this.timeout(300000);
        beforeEachTestCase();
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ngl-fixstatus-"));
        // An unused variable is a genuine (non-layout) violation that fixing nothing leaves in place.
        fs.writeFileSync(path.join(tmpDir, "Unused.groovy"), "def unusedVariable = 1\nprintln 'hello'\n");
        const linter = new NpmGroovyLint({ path: tmpDir, insight: false, failon: "info", output: "none" }, {});
        await linter.run();
        assert(linter.status === 1, `Initial lint must fail on the unused variable (status ${linter.status})`);
        // Simulate the --fix flow having borrowed format rules, then fix nothing: the
        // post-filter status reset must be recomputed from the remaining real violations
        // instead of leaking status 0 to API callers (e.g. the VS Code extension).
        linter.borrowedFormatRules = ["TrailingWhitespace"];
        await linter.fixErrors([999999999]);
        assert.strictEqual(
            linter.status,
            1,
            `fixErrors() must keep status 1 while a failon-level non-borrowed violation remains, got ${linter.status}`,
        );
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });
});
