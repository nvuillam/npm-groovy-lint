// scripts/update-java-jars.js
// Node.js script to fetch the latest Groovy, Jackson, Logback, and SLF4J JARs into lib/java/
// Requires: node-fetch (v3), fs/promises
// Usage: node scripts/update-java-jars.js

import fs from 'fs/promises';
import path from 'path';
import fetch from 'node-fetch';
import { fileURLToPath } from 'url';
import { Buffer } from 'buffer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const JAVA_DIR = path.join(__dirname, '../lib/java');
const GROOVY_DIR = path.join(JAVA_DIR, 'groovy', 'lib');
const TARGETS = [
    // [groupId, artifactId, targetDir]
    ['org.apache.groovy', [
        'groovy',
        'groovy-ant',
        'groovy-cli-commons',
        'groovy-dateutil',
        'groovy-json',
        'groovy-templates',
        'groovy-xml'],
        GROOVY_DIR],
    // Additional groovy/lib dependencies
    ['commons-cli', ['commons-cli'], GROOVY_DIR],
    ['org.apache.ant', ['ant', 'ant-launcher'], GROOVY_DIR],
    // Java root dependencies
    ['com.fasterxml.jackson.core', ['jackson-core', 'jackson-databind', 'jackson-annotations'], JAVA_DIR],
    ['ch.qos.logback', ['logback-classic', 'logback-core'], JAVA_DIR],
    ['org.slf4j', ['slf4j-api'], JAVA_DIR],
    ['org.codehaus.janino', ['janino', 'commons-compiler'], JAVA_DIR],
    ['org.codenarc', ['CodeNarc'], JAVA_DIR],
    ['org.gmetrics', ['GMetrics-Groovy4'], JAVA_DIR],
    // CodeNarcServer is likely a custom build, not from Maven Central
];

async function getLatestVersion(groupId, artifactId) {
    // Fetch up to 20 versions and pick the latest stable (no -alpha, -beta, -rc, -SNAPSHOT)
    const url = `https://search.maven.org/solrsearch/select?q=g:%22${groupId}%22+AND+a:%22${artifactId}%22&rows=100&core=gav&wt=json`;
    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(`Failed to fetch version for ${groupId}:${artifactId}`);
    }
    const data = await res.json();
    const versions = data.response.docs
        .map(doc => doc.latestVersion || doc.v)
        .filter(Boolean);
    // Filter out pre-releases
    const stable = versions.filter(v => !/[-.](alpha|beta|rc|m|SNAPSHOT)/i.test(v));
    // Only keep versions that look like semver (x.y.z or x.y.z-...)
    const semver = stable.filter(v => /^\d+\.\d+\.\d+([-.].*)?$/.test(v));
    if (semver.length === 0) {
        throw new Error(`No stable semver version found for ${groupId}:${artifactId} in ${versions.join(', ')}`);
    }
    // Sort by semver descending (naive, but works for most)
    semver.sort((a, b) => b.localeCompare(a, undefined, { numeric: true, sensitivity: 'base' }));
    return semver[0];
}

async function downloadJar(groupId, artifactId, version, dir) {
    const jarName = `${artifactId}-${version}.jar`;
    const url = `https://repo1.maven.org/maven2/${groupId.replace(/\./g, '/')}/${artifactId}/${version}/${jarName}`;
    const dest = path.join(dir, jarName);
    console.log(`Downloading ${jarName} to ${dir} ...`);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to download ${jarName}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    await fs.writeFile(dest, buffer);
}

async function removeOldJars(artifactId, dir) {
    const files = await fs.readdir(dir);
    for (const file of files) {
        if (file.startsWith(artifactId + '-') && file.endsWith('.jar')) {
            await fs.unlink(path.join(dir, file));
        }
    }
}

async function main() {
    await fs.mkdir(JAVA_DIR, { recursive: true });
    await fs.mkdir(GROOVY_DIR, { recursive: true });
    for (const [groupId, artifactIds, targetDir] of TARGETS) {
        await fs.mkdir(targetDir, { recursive: true });
        for (const artifactId of artifactIds) {
            await removeOldJars(artifactId, targetDir);
            const version = await getLatestVersion(groupId, artifactId);
            await downloadJar(groupId, artifactId, version, targetDir);
        }
    }
    console.log(`All JARs updated in ${JAVA_DIR} and ${GROOVY_DIR}`);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
