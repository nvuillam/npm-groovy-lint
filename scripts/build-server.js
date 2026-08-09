// Build Server creating a deterministic jar file.

// Imports
import fs from 'fs-extra';
import * as childProcess from "child_process";
import Handlebars from 'handlebars';
import AdmZip from 'adm-zip';
import * as path  from 'path';
import * as glob from 'glob';

const srcDir = 'groovy/src/main';
const metaDir = 'META-INF';
const manifestFile = 'MANIFEST.MF';
const jarFile = 'CodeNarcServer.jar';
const libDir = 'lib/java/';
const logConfig = 'logback.xml';
const manifestTemplate = `Manifest-Version: 1.0
Class-Path: {{classPath}}
Created-By: 1.8.0_144 (Oracle Corporation)
Main-Class: com.nvuillam.CodeNarcServer
`;
const tmpDir = 'tmp';
const classPath = 'com/nvuillam';
const classDir = `${tmpDir}/${classPath}`;

// Returns a map of file names times of the current jar file.
function jarFileTimes() {
    console.info('Getting jar file times...');
    let file = `${libDir}${jarFile}`;
    let zip = new AdmZip(file);
    let zipEntries = zip.getEntries();

    let details = new Map();
    zipEntries.forEach(function(zipEntry) {
        details.set(zipEntry.entryName, zipEntry.header.time);
    });

    return details;
}
// Compile the server groovy.
function compileGroovy() {
    console.info('Compiling groovy...');
    const groovyFiles = glob.sync(`${srcDir}/${classPath}/*.groovy`).join(' ');
    childProcess.execSync(`groovyc -cp "lib/java/*" --encoding utf-8 ${groovyFiles} -d ${tmpDir}`, (err, stdout, stderr) => {
        if (err) {
            console.error(err);
            console.error(stdout);
            console.error(stderr);

            throw err;
        }
    });
}

// Builds the manifest file into the temporary directory.
function buildManifest() {
    console.info('Building manifest...');
    let jars = [];
    ['', 'groovy/lib/'].forEach((dir) => {
        let fsDir = fs.opendirSync(`${libDir}${dir}`)
        let dirent
        while ((dirent = fsDir.readSync()) !== null) {
            if (dirent.name == jarFile || !dirent.name.endsWith('.jar')) {
                continue;
            }
            jars.push(`${dir}${dirent.name}`);
        }
        fsDir.closeSync()
    });

    // Sort the jars so that the manifest is deterministic.
    jars.sort();

    // Wrap the class path to 72 characters.
    let jarsStr = jars.join(' ');
    let wrapped = '';
    while (jarsStr.length > 0) {
        if (wrapped.length == 0) {
            wrapped += jarsStr.slice(0, 58);
            jarsStr = jarsStr.slice(58);
        } else {
            wrapped += ` ${jarsStr.slice(0, 69)}`;
            jarsStr = jarsStr.slice(69);
        }

        if (jarsStr.length > 0) {
            wrapped += '\n';
        }
    }

    // Update the manifest file if it has changed.
    const template = Handlebars.compile(manifestTemplate);
    const contents = template({classPath: wrapped});

    const srcManifestFile = `${srcDir}/${manifestFile}`;
    const oldContents = fs.readFileSync(srcManifestFile);
    if (contents == oldContents) {
        console.info('Manifest unchanged');
    } else {
        console.info('Updating manifest...');
        fs.writeFileSync(srcManifestFile, contents);
    }

    // Copy the manifest file to the tmp directory.
    const tmpMetaDir = `${tmpDir}/${metaDir}`;
    if (!fs.existsSync(tmpMetaDir)) {
        fs.mkdirSync(tmpMetaDir);
    }

    const tmpManifestFile = `${tmpMetaDir}/${manifestFile}`;
    fs.copyFileSync(srcManifestFile, tmpManifestFile);
}

// Build the jar file.
function buildJar(jarFileTimes) {
    console.info('Building jar...');

    // Build the list of files to add to the jar.
    let files = [
        `${metaDir}/${manifestFile}`,
        logConfig,
    ];
    let dirent;
    let fsDir = fs.opendirSync(classDir)
    while ((dirent = fsDir.readSync()) !== null) {
        if (!dirent.isFile()) {
            continue;
        }
        files.push(`${classPath}/${dirent.name}`);
    }
    fsDir.closeSync();

    // Sort the files so that the jar file is deterministic.
    files.sort();

    // Copy log config in.
    fs.copyFileSync(`${libDir}${logConfig}`, `${tmpDir}/${logConfig}`);

    // Create the jar file.
    var jar = new AdmZip();
    files.forEach((file) => {
        let origTime = jarFileTimes.get(file);
        let tmpFile = `${tmpDir}/${file}`;
        if (origTime) {
            // Set the original timestamp so that the jar file is deterministic.
            fs.utimesSync(tmpFile, origTime, origTime);
        }

        let zipPath = path.dirname(file)
        if (zipPath == '.') {
            zipPath = '';
        }
        jar.addLocalFile(tmpFile, zipPath);
    });

    jar.writeZip(`${libDir}${jarFile}`);
}

try {
    let fileTimes = jarFileTimes();
    compileGroovy();
    buildManifest(fileTimes);
    buildJar(fileTimes);
} finally {
    console.info('Cleaning up...');
    fs.rmSync(tmpDir, { recursive: true, force: true });
}
