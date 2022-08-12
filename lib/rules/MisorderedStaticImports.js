// Unused import

/*
Update list following format
{
  "// myComment1" : [ "import a.b.c" , "import d.e.f"] 
  "// myComment2" : [ "import h.e.j" , "import we.sh"] 
}
*/
function addInImportsList(importsLs, commentLine, importLine) {
    const commentImportObjs = importsLs.filter(importObj => importObj.commentLine === commentLine);
    const commentImportObj = commentImportObjs && commentImportObjs[0] ? commentImportObjs[0] : { commentLine: commentLine, importLines: [] };
    commentImportObj.importLines.push(importLine);
    commentImportObj.importLines.sort();
    if (commentImportObjs && commentImportObjs.length > 0) {
        importsLs = importsLs.map(importObj => (importObj.commentLine === commentLine ? commentImportObj : importObj));
    } else {
        importsLs.push(commentImportObj);
    }
    return importsLs;
}

// Build ordered import lines
function buildImportLines(importsLs, allImportLines, removeLastEmptyLine = false) {
    for (const importObj of importsLs) {
        if (importObj.commentLine !== "") {
            allImportLines.push(importObj.commentLine);
        }
        allImportLines.push(...importObj.importLines);
        allImportLines.push("");
    }
    if (removeLastEmptyLine && importsLs.length > 0) {
        allImportLines.pop();
    }
}

const rule = {
    scope: "file",
    unitary: true,
    fix: {
        label: "Reorder imports",
        type: "function",
        func: allLines => {
            let lastCommentFound = "";
            let lastCommentFoundPos = null;
            let firstCommentFoundPos = null;
            let firstImportFoundPos = null;
            let lastImportFoundPos = null;
            const imports = {
                static: [],
                normal: []
            };
            let pos = 0;
            // Parse all lines and store what we need in imports object
            for (const line of allLines) {
                // Comment line preceding import
                if (line.trimStart().startsWith("//") && allLines[pos + 1].trim().startsWith("import")) {
                    lastCommentFound = line;
                    lastCommentFoundPos = pos;
                } else if (line.trimStart().startsWith("import")) {
                    // Import static line
                    if (line.trimStart().startsWith("import static")) {
                        const commentKey =
                            imports.normal.filter(importObj => importObj.commentLine === lastCommentFound).length === 0 ? lastCommentFound : "";
                        imports.static = addInImportsList(imports.static, commentKey, line);
                    }
                    // Import line
                    else {
                        const commentKey =
                            imports.static.filter(importObj => importObj.commentLine === lastCommentFound).length === 0 ? lastCommentFound : "";
                        imports.normal = addInImportsList(imports.normal, commentKey, line);
                    }
                    // Update positions for later build of ordered imports with comments
                    firstImportFoundPos = firstImportFoundPos || firstImportFoundPos === 0 ? firstImportFoundPos : pos;
                    lastImportFoundPos = pos;
                    firstCommentFoundPos =
                        firstCommentFoundPos || firstCommentFoundPos === 0
                            ? firstCommentFoundPos
                            : lastCommentFound === ""
                            ? null
                            : lastCommentFoundPos;
                }
                pos++;
            }
            // Rewrite ordered imports
            const allImportLines = [];
            buildImportLines(imports.static, allImportLines);
            buildImportLines(imports.normal, allImportLines, true);
            const startPos = firstCommentFoundPos ? Math.min(firstCommentFoundPos, firstImportFoundPos) : firstImportFoundPos;
            allLines.splice(startPos, lastImportFoundPos - startPos + 1, ...allImportLines);
            return allLines;
        }
    },

    tests: [
        {
            sourceBefore: `
// Blablabla this script is for whatever

// Some imports
import groovy.io.FileType
import groovy.transform.Field
import groovy.xml.*
import groovy.json.*
import groovy.time.TimeCategory

// Some other imports
import java.io.File

// And again other imports
import after.all.does.it.work

// Yeah my static imports
import static groovyx.zpars.GParsPool.withPoolZ
import static groovyx.gpars.GParsPool.withPool

// The rest of the file below ...
`,
            sourceAfter: `
// Blablabla this script is for whatever

// Yeah my static imports
import static groovyx.gpars.GParsPool.withPool
import static groovyx.zpars.GParsPool.withPoolZ

// Some imports
import groovy.io.FileType
import groovy.json.*
import groovy.time.TimeCategory
import groovy.transform.Field
import groovy.xml.*

// Some other imports
import java.io.File

// And again other imports
import after.all.does.it.work

// The rest of the file below ...
`
        },
        {
            sourceBefore: `
import groovy.io.FileType
import groovy.transform.Field
import groovy.xml.*
import groovy.json.*
import groovy.time.TimeCategory

// Some other imports
import java.io.File

// Yeah my static imports
import static groovyx.zpars.GParsPool.withPoolZ
import static groovyx.gpars.GParsPool.withPool
// And again other imports
import after.all.does.it.work

// The rest of the file below ...
`,
            sourceAfter: `
// Yeah my static imports
import static groovyx.gpars.GParsPool.withPool
import static groovyx.zpars.GParsPool.withPoolZ

import groovy.io.FileType
import groovy.json.*
import groovy.time.TimeCategory
import groovy.transform.Field
import groovy.xml.*

// Some other imports
import java.io.File

// And again other imports
import after.all.does.it.work

// The rest of the file below ...
`
        } /*,
        {
            sourceBefore: `
// Blablabla grapes
@Grapes([
    @Grab(group='org.codehaus.groovy.modules.http-builder', module='http-builder', version='0.7.1'),
    @Grab(group='com.google.guava', module='guava', version='19.0'),
    @Grab(group='org.apache.commons', module='commons-lang3', version='3.7')
    ])
// Blablabla imports
import groovy.io.FileType
import groovy.transform.Field
import groovy.xml.*
import groovy.json.*
import groovy.time.TimeCategory

// Some other imports
import java.io.File

// Yeah my static imports
import static groovyx.zpars.GParsPool.withPoolZ
import static groovyx.gpars.GParsPool.withPool
// And again other imports
import after.all.does.it.work

// The rest of the file below ...
`,
            sourceAfter: `
// Blablabla grapes
@Grapes([
    @Grab(group='org.codehaus.groovy.modules.http-builder', module='http-builder', version='0.7.1'),
    @Grab(group='com.google.guava', module='guava', version='19.0'),
    @Grab(group='org.apache.commons', module='commons-lang3', version='3.7')
    ])
// Yeah my static imports
import static groovyx.gpars.GParsPool.withPool
import static groovyx.zpars.GParsPool.withPoolZ

// Blablabla imports
import groovy.io.FileType
import groovy.json.*
import groovy.time.TimeCategory
import groovy.transform.Field
import groovy.xml.*

// Some other imports
import java.io.File

// And again other imports
import after.all.does.it.work

// The rest of the file below ...
`
        } */
    ]
};

module.exports = { rule };
