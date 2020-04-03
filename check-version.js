const semver = require('semver');
const FindPackageJson = require("find-package-json");

const finder = FindPackageJson(__dirname);
const pckg = finder.next().value;
const version = pckg.engines.node;
if (!semver.satisfies(process.version, version)) {
    console.error(`Required node version ${version} not satisfied with current version ${process.version}.`);
    process.exit(1);
}