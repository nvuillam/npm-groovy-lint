---
name: upgrade-java-deps
description: Upgrade CodeNarc and the bundled Java dependencies (jackson, logback, slf4j, janino, GMetrics, Groovy libs) that ship inside lib/java/, rebuild the deterministic CodeNarcServer.jar, and verify nothing regressed. Use when bumping CodeNarc, fixing a grype/trivy CVE in a bundled jar, or refreshing the Java toolchain.
allowed-tools: Bash Read Grep Glob Edit Write
user-invocable: true
model: sonnet
---

Upgrade the Java jars bundled under `lib/java/` and rebuild the CodeNarc server.

## Background: why this is not just `npm update`

npm-groovy-lint ships a set of **committed Java jars** in `lib/java/` (and Groovy's own libs in `lib/java/groovy/lib/`). The Node CLI starts `lib/java/CodeNarcServer.jar` (a thin Groovy server compiled from `groovy/src/main/`) whose `MANIFEST.MF` `Class-Path` lists **every sibling jar by exact filename**. So a dependency upgrade means: swap the jar file, regenerate the manifest, recompile + repackage the server jar, and verify both run paths still work.

Security scanners in MegaLinter (**grype**, **trivy**) scan these jars, so jar CVEs surface as Mega-Linter failures even though `npm audit` is clean.

The jars:
- **Root** (`lib/java/`): `CodeNarc-*-groovy-4.0.jar`, `GMetrics-Groovy4-*.jar`, `jackson-{core,databind,annotations}-*.jar`, `logback-{classic,core}-*.jar`, `slf4j-api-*.jar`, `janino-*.jar`, `commons-compiler-*.jar` — plus `logback.xml` and the built `CodeNarcServer.jar`.
- **Groovy** (`lib/java/groovy/lib/`): `groovy-*`, `groovy-ant`, `commons-cli`, `ant*`.

The download targets and group/artifact IDs are codified in **`scripts/update-java-jars.js`** (`TARGETS`). Read it first — it is the source of truth for what is bundled and where.

## Prerequisites

- **JDK 17–24** and **Groovy** (`groovyc`) on PATH. Check: `java -version`, `groovy --version`. CodeNarc 3.x targets Groovy 4 (`-groovy-4.0` jars), so keep the Groovy libs on the 4.x line.
- Run from a feature branch, never `main`.

## Option A — bump everything to latest (broad)

```bash
npm run dev:upgrade-jars      # = node scripts/update-java-jars.js  (fetches LATEST stable of every TARGET)
npm run dev:pre-commit        # lint:fix + build + server:build (regenerates manifest + CodeNarcServer.jar)
```

`update-java-jars.js` removes old jars and downloads the newest stable from Maven Central. Use this for a routine refresh. **Caveat:** it also bumps CodeNarc / GMetrics / Groovy, which can change lint output or break the server — always run the full verification below and review the result diff.

## Option B — surgical upgrade (recommended for a CVE fix)

When only specific jars are flagged (e.g. by grype), replace just those so you don't accidentally bump CodeNarc/Groovy.

1. **Find the fixed version that actually exists.** grype reports a "fixed in" version, but it may be unpublished or ahead of Maven Central. Probe before committing to a version:

   ```bash
   # HEAD-probe a specific jar (Windows curl needs --ssl-no-revoke)
   probe() { curl -sS --ssl-no-revoke -m 25 -o /dev/null -w "%{http_code}  $2-$3\n" \
     "https://repo1.maven.org/maven2/${1//.//}/$2/$3/$2-$3.jar"; }
   probe com.fasterxml.jackson.core jackson-databind 2.22.0
   probe ch.qos.logback logback-core 1.5.25
   ```

   If the exact "fixed in" patch is unpublished, jump to the next published version whose number is **above** the advisory's vulnerable range (check `https://api.github.com/advisories/<GHSA-ID>` for the real range). Example seen in practice: GHSA fixed-in `2.21.5` (unpublished) → use `2.22.0`, which is above the `< 2.21.5` range.

2. **Keep version sets consistent.**
   - **jackson**: upgrade `jackson-core`, `jackson-databind`, `jackson-annotations` together to the same release train. Note **`jackson-annotations` uses a minor-only version** (e.g. `jackson-annotations-2.22.jar`, *not* `2.22.0`) — confirm the exact artifact name with a probe.
   - **logback**: upgrade `logback-classic` **and** `logback-core` to the same version.

3. **Download new, delete old:**

   ```bash
   cd lib/java
   curl -sS --ssl-no-revoke -O "https://repo1.maven.org/maven2/com/fasterxml/jackson/core/jackson-databind/2.22.0/jackson-databind-2.22.0.jar"
   # ...repeat for each jar...
   rm jackson-databind-2.19.0.jar   # remove the superseded versions
   unzip -l jackson-databind-2.22.0.jar >/dev/null && echo OK   # sanity-check it's a valid zip
   cd ../..
   ```

4. **Rebuild:** `npm run server:build` (regenerates `groovy/src/main/MANIFEST.MF` Class-Path + `lib/java/CodeNarcServer.jar`).

## CRITICAL: logback.xml and the one-shot (`--noserver`) path

There are **two run paths** and they fail differently:
- **Server mode** (default): Node starts the jar once and talks HTTP. Startup noise is harmless.
- **One-shot mode** (`--noserver`, and several tests): Node runs `java ... com.nvuillam.CodeNarcServer <args>` and **`JSON.parse`s the entire stdout**. Anything else on stdout breaks it ("Unable to use CodeNarc JSON result").

logback prints its **internal status log to stdout** whenever a config WARN/ERROR occurs. Newer logback versions deprecate the `condition` *attribute* on `<if>` (emitting a WARN) — which dumps status onto stdout and breaks one-shot mode. Mitigations, both already applied in `lib/java/logback.xml`, that you must preserve when bumping logback:
- A **`<statusListener class="ch.qos.logback.core.status.NopStatusListener"/>`** as the **first** child of `<configuration>` to silence status output.
- Keep the `<if condition='isDefined("...")'>` **attribute** form. (The `<condition>` *element* form does NOT enable the appender in 1.5.x — it silently evaluates false and the FILE appender is never created, breaking the "log file creation" test.)
- XML comments must not contain a literal `--` (double hyphen) — it's a fatal XML parse error that itself triggers a status dump. Write "no server", not "`--`server".

If a future logback bump changes this behavior, the canonical check is step "verify A" below (stdout must start with `{`).

## Verify (do all three)

```bash
node lib/index.js --killserver
# A) one-shot stdout must be pure JSON (no logback status, no banner)
printf 'def x=1\nprintln x\n' > /tmp/smoke.groovy
node lib/index.js --noserver /tmp/smoke.groovy            # must print a clean results table, exit 0/1 (not 2)

# B) server path
node lib/index.js --killserver && node lib/index.js /tmp/smoke.groovy

# C) full suite (needs Java + Groovy; ~10-15 min)
npm run test
```

A clean one-shot run is the key signal the jackson/logback swap is healthy. If `npm test` shows failures, **confirm they are caused by your change** before fixing: `git stash push -- lib/java groovy/src/main/MANIFEST.MF`, re-run the failing test on the original jars, then `git stash pop`. Some tests (e.g. an `exec` with escaped-quote rulesets like `NoDef{"enabled":false}`) fail only on **Windows-local** shell quoting and are green in CI — don't chase those.

## Commit

The `lint.yml` "Update check" CI job runs `npm run dev:pre-commit` and fails if the tree isn't clean, so run it and stage **all** regenerated artifacts (the new jars, the deleted old jars, `MANIFEST.MF`, `CodeNarcServer.jar`, and `logback.xml` if touched).

```bash
npm run dev:pre-commit
git add lib/java groovy/src/main/MANIFEST.MF
git commit   # use a "Fix CI:" / "chore(deps):" style message
```

**Gotcha:** `CodeNarcServer.jar` is built deterministically, but its zlib compression is sensitive to the **Node version**. If "Update check" reports the jar as changed after you ran `dev:pre-commit`, rebuild with the same Node version CI uses (see `CONTRIBUTING.md`).
