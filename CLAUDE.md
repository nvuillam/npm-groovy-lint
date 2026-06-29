# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`npm-groovy-lint` is a Node.js (ESM) CLI + library that **lints, formats and auto-fixes** Groovy / Jenkinsfile / Gradle files. It is a wrapper around the Java tool [CodeNarc](http://codenarc.github.io/CodeNarc/): the Node side translates options, drives CodeNarc, parses its results, and adds a formatting/auto-fix engine that CodeNarc does not have. It also powers the VS Code "Groovy Lint" extension and the MegaLinter Groovy flavor.

Requires **Node >= 22** and a **JDK 17–24** on PATH (Groovy is also needed to rebuild the server — see below).

## Commands

```shell
npm install && npm link      # dev setup (link makes the `npm-groovy-lint` bin available)
npm run test                 # full test suite (kills any running server first, then Mocha)
npm run test -- --grep "format"   # run a subset of tests by name
npm run test:debug           # Mocha with --inspect-brk
npm run test:coverage        # nyc coverage (the CI "No Java" leg)
npm run lint:fix             # ESLint --fix + Prettier (tab-width 4, print-width 150)
npm run build                # regenerate config presets + copy README/CHANGELOG into docs/
npm run server:build         # recompile the Groovy server -> lib/java/CodeNarcServer.jar
npm run dev:pre-commit       # lint:fix + build + server:build  (run this before committing)
npm run dev:upgrade-jars     # re-download latest Java jars into lib/java/
```

There is **no Husky hook**. Quality is enforced by CI (`lint.yml`, the "Update check" job), which runs `npm run dev:pre-commit` and then fails if the working tree is not clean. So always run `npm run dev:pre-commit` yourself after changing anything that feeds a generated artifact, and commit the regenerated files.

## Architecture

### Two-process design (Node ⇄ Java)
The expensive part — starting a JVM and loading CodeNarc — is amortized by running CodeNarc as a **long-lived local HTTP server** (`CodeNarcServer.jar`). The Node CLI starts the server on first use, then talks to it over HTTP (axios, forced to IPv4 because the JVM prefers it). Subsequent invocations reuse the running server, which is why linting feels fast after the first call. `--noserver` bypasses this and invokes the Java jar directly per call; `--killserver` stops the daemon (the test script does this first).

- `lib/index.js` — CLI entry (`bin`), thin wrapper that runs `NpmGroovyLint` and sets the exit code.
- `lib/groovy-lint.js` — `NpmGroovyLint` class, the orchestrator: parse options → prepare CodeNarc call → run via the caller → parse results → optionally format/fix → produce output.
- `lib/codenarc-caller.js` — owns the **server lifecycle and Java invocation** (find Java, start/keep-alive the server, HTTP calls, java fallback). Java version bounds (17–24) and jar path live here.
- `lib/codenarc-factory.js` — converts npm-groovy-lint options into CodeNarc args (creating temp ruleset/files as needed) and parses the CodeNarc result back into the npm-groovy-lint error model.
- `lib/config.js` — resolves `.groovylintrc.{json,js,yml}` / `package.json` config, and the built-in presets `recommended | recommended-jenkinsfile | all`.
- `lib/options.js` — CLI option definitions (optionator).
- `lib/output.js`, `lib/filter.js`, `lib/utils.js` — result formatting (txt/json/sarif/html/xml), error filtering (incl. inline disable blocks), and shared helpers.

### Auto-fix engine
This is the main value added on top of CodeNarc. `lib/groovy-lint-fix.js` applies fixes; the per-rule fix logic lives in **`lib/rules/*.js`** (~70 files), aggregated by `lib/groovy-lint-rules.js`. Each rule file exports a descriptor object — see the documented template at the top of `lib/groovy-lint-rules.js`. Key fields:
- `scope` (`line` default, or `file` when the fix affects more than the matched line)
- `variables` — regexes that extract values from the CodeNarc error message
- `range` — computes the editor range (used by the VS Code extension)
- `fix` — the transformation; `triggers` / `triggersAgainAfterFix` re-run related rules (e.g. re-running `Indentation` after a brace fix)

### The Java/Groovy server (built artifact)
- Source: `groovy/src/main/com/nvuillam/*.groovy` (the server, gzip filters, request/response, capture plugin).
- Build: `scripts/build-server.js` compiles with `groovyc`, regenerates `groovy/src/main/MANIFEST.MF` (a `Class-Path` listing **every jar filename** in `lib/java/` and `lib/java/groovy/lib/`), and zips a **deterministic** `lib/java/CodeNarcServer.jar`.
- The dependency jars (CodeNarc, GMetrics, jackson, logback, slf4j, janino, groovy/*) are committed under `lib/java/`. To change a dependency: drop the new jar in (or run `npm run dev:upgrade-jars`), delete the old one, then `npm run server:build` so the manifest's `Class-Path` points at the new filename.

**Gotcha:** the committed jar is deterministic but its zlib compression is sensitive to the Node version. If the "Update check" CI job reports `lib/java/CodeNarcServer.jar` as changed even though you ran `dev:pre-commit`, rebuild it with the **same Node version as CI** (see `CONTRIBUTING.md`).

### Config presets
`scripts/build-config-all.js` generates `lib/.groovylintrc-*.json` (the `recommended`, `recommended-jenkinsfile`, `all`, `format` presets) — regenerated by `npm run build`; don't hand-edit the generated files.

## Tests
Mocha (`test/**/*.test.js`), bootstrapped by `test/helpers/init.js` with a custom silent reporter; per-test timeout is 300s because real CodeNarc runs are involved. Tests require Java **and** Groovy installed locally and start a real server, so they are integration-heavy rather than pure unit tests.
