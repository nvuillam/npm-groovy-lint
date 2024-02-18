// Filter errors
"use strict";

// Parse source to list parts where errors must be ignored
function collectDisabledBlocks(allLines) {
    const disabledBlocks = [];
    let lineNb = 0;
    for (const line of allLines) {
        // Disable start comment
        if (line.includes("groovylint-disable") && !line.includes("groovylint-disable-line") && !line.includes("groovylint-disable-next-line")) {
            const disabledRules = parseGroovyLintComment("groovylint-disable", line);
            disabledBlocks.push({ rules: disabledRules, startLine: lineNb });
        }
        // Disable end comment
        else if (line.includes("groovylint-enable")) {
            const enabledRules = parseGroovyLintComment("groovylint-enable", line);
            const matchingIndex = disabledBlocks.findIndex(
                disabledBlock =>
                    disabledBlock.endLine == null &&
                    lineNb >= disabledBlock.startLine &&
                    disabledBlock.rules.sort().toString() == enabledRules.sort().toString()
            );
            if (matchingIndex > -1) {
                disabledBlocks[matchingIndex].endLine = lineNb;
            } else {
                console.warn(`npm-groovy-lint: Unable to find matching groovylint-disable for ${line}`);
            }
        }
        lineNb++;
    }
    // Set last line pos as endLine for the groovylint-disable not matched with a groovylint-enable
    return disabledBlocks.map(disabledBlock => {
        if (disabledBlock.endLine == null) {
            disabledBlock.endLine = allLines.length;
        }
        return disabledBlock;
    });
}
// Check if an error returned by CodeNarc should be filtered by npm-groovy-lint according to comments instructions
function isFilteredError(errItem, allLines, disabledBlocks) {
    const linePos = errItem.line - 1;
    const line = allLines[linePos] || "";
    const ruleName = errItem.rule;

    // matches groovylint-disable blocks
    const matchingDisabledBlocks = disabledBlocks.filter(
        disabledBlock => disabledBlock.startLine <= linePos && disabledBlock.endLine >= linePos && checkMatch(disabledBlock.rules, ruleName)
    );
    if (matchingDisabledBlocks.length > 0) {
        return true;
    }
    // groovylint-disable-line on same line
    const lineConfigCurrLine = parseGroovyLintComment("groovylint-disable-line", line);
    if (checkMatch(lineConfigCurrLine, ruleName)) {
        return true;
    }
    // groovylint-disable-next-line in previous line
    const lineConfigNextLine = parseGroovyLintComment("groovylint-disable-next-line", allLines[linePos - 1] || "");
    if (checkMatch(lineConfigNextLine, ruleName)) {
        return true;
    }

    return false;
}

// Parse GroovyLint comment (with additional parameters if present)
// ex: "// groovylint-disable NoDef, Indentation" will return ["NoDef", "Indentation"]
// ex: "// groovylint-disable" will return "all"
function parseGroovyLintComment(type, line) {
    if (line.includes(type)) {
        const typeDetail = cleanFromCommentMarks(line)
            .replace(type, "")
            .trim();
        if (typeDetail) {
            const errors = typeDetail.split(",").map(errType => errType.trim());
            return errors;
        }
        return ["all"];
    }
    return false;
}

// Check if the rule name is matching the groovylint comment
function checkMatch(lineConfig, ruleName) {
    return lineConfig !== false && (lineConfig[0] === "all" || lineConfig.includes(ruleName));
}

// Remove comment marks /* */ //
function cleanFromCommentMarks(str) {
    if (str.indexOf("//")) {
        str = str.substring(str.indexOf("//"));
    }
    return str
        .replace("/*", "")
        .replace("//", "")
        .replace("*/", "")
        .trim();
}

module.exports = { collectDisabledBlocks, isFilteredError };
