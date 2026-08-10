// Fail if the number of production npm packages grows beyond the committed baseline,
// to keep the supply-chain surface under control.
// If an increase is intentional and justified, update MAX_PROD_PACKAGES below in the same PR.

import { execSync } from "child_process";

// Baseline 2026-08 is 27 packages: java-caller (+ njre/tar/yauzl/semver), optionator, js-yaml, node-sarif-builder.
// The ceiling keeps a small buffer so a transitive dependency added by an upstream patch release does not
// break CI on sight: the guard is here to catch us adding dependencies, not to pin the whole tree.
const MAX_PROD_PACKAGES = 30;

let output;
try {
    output = execSync("npm ls --all --omit=dev --parseable", { encoding: "utf8" });
} catch (e) {
    // npm ls exits non-zero when the installed tree has problems (missing or invalid dependencies)
    console.error("Unable to count production dependencies: npm ls reported problems with the installed tree (run npm ci and retry).");
    console.error(String(e.stderr || e.message));
    process.exit(1);
}
const count = new Set(output.split(/\r?\n/).filter(Boolean)).size - 1; // -1 for the root project itself

if (count > MAX_PROD_PACKAGES) {
    console.error(`Production dependency count ${count} exceeds the allowed maximum of ${MAX_PROD_PACKAGES}.`);
    console.error("Run `npm ls --all --omit=dev` to see what was added: it may be a new direct dependency, or an");
    console.error("upstream package that grew its own dependencies. If the increase is justified, raise");
    console.error("MAX_PROD_PACKAGES in scripts/check-dependencies.js in the same PR.");
    process.exit(1);
}
console.info(`Production dependency count OK: ${count} <= ${MAX_PROD_PACKAGES}`);
