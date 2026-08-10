// Fail if the number of production npm packages grows beyond the committed baseline,
// to keep the supply-chain surface under control.
// If an increase is intentional and justified, update MAX_PROD_PACKAGES below in the same PR.

import { execSync } from "child_process";

const MAX_PROD_PACKAGES = 27; // baseline 2026-08: java-caller (+ njre/tar/yauzl/semver), optionator, js-yaml, node-sarif-builder

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
    console.error("If this increase is intentional, update MAX_PROD_PACKAGES in scripts/check-dependencies.js in the same PR.");
    process.exit(1);
}
console.info(`Production dependency count OK: ${count} <= ${MAX_PROD_PACKAGES}`);
