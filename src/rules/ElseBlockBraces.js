// Missing else braces
const { containsOtherThan, getStringRangeMultiline, getVariable, isValidCodeLine } = require("../utils");

const rule = {
    scope: "file",
    unitary: true,
    triggers: ["ClosingBraceNotAlone"],
    triggersAgainAfterFix: ["Indentation", "IndentationClosingBraces", "IndentationComments"],
    range: {
        type: "function",
        func: (_errLine, errItem, _evaluatedVars, allLines) => {
            return getStringRangeMultiline(allLines, "else", errItem, "if");
        }
    },
    fix: {
        label: "Add else statement braces",
        type: "function",
        func: (allLines, variables) => {
            const range = getVariable(variables, "range", { mandatory: true });
            const lineNumber = range.start.line - 1;
            let line = allLines[lineNumber];
            // If next line is also a if/else, this rule can not auto-fix for now, it has to be done manually
            const nextLineAfterFoundOne = allLines[lineNumber + 1];
            if (
                (nextLineAfterFoundOne &&
                    (nextLineAfterFoundOne.includes("if (") || nextLineAfterFoundOne.includes("if(") || nextLineAfterFoundOne.includes("else {"))) ||
                line.includes(";") ||
                containsOtherThan(line, ["else", "}", "{", " "])
            ) {
                return allLines;
            }
            // Check we are on the correct line to correct, if not trigger error
            if (!line.includes("else")) {
                throw new Error('Line does not contain "else" :' + line);
            }
            if (line.includes("{")) {
                throw new Error("Line already has an opening brace :" + line);
            }
            // Add opening brace
            line = line.trimEnd() + " {";
            allLines[lineNumber] = line;
            // Add a tag ###NEWLINECLOSINGBRACE### to indicate rule ClosingBraceNotAlone to replace it by a closing brace & carriage return
            let match = false;
            let pos = 0;
            let level = 0;
            while (!match && pos < allLines.length) {
                let nextLine = allLines[lineNumber + pos + 1];
                if (isValidCodeLine(nextLine) && level === 0) {
                    if (!nextLine.trim().startsWith("if") && !nextLine.includes("{") && !nextLine.includes("}")) {
                        nextLine = nextLine + "###NEWLINECLOSINGBRACE###";
                        allLines[lineNumber + pos + 1] = nextLine;
                        match = true;
                    } else if (nextLine.includes("}") && !nextLine.includes("{")) {
                        level--;
                    } else {
                        level++;
                    }
                }
                pos++;
            }
            return allLines;
        }
    },
    tests: [
        {
            sourceBefore: `
if (a == 1) {
    whatever() 
}
else 
    whateverElse()
`,
            sourceAfter: `
if (a == 1) {
    whatever() 
}
else {
    whateverElse()
}
`,
            codeNarcCallsNumber: 2
        },
        {
            sourceBefore: `
if (new File(sfdxWorkingDir + '/.sfdx').exists() && this.promptForReloadMetadatas == true ) {
    doRetrieve = Utils.userPromptOkCancel('Metadatas already existing in local project.\\nDo you want to fetch them again ? (if you don\\'t know, input N)', 5)
}
else
    doRetrieve = true
`,
            sourceAfter: `
if (new File(sfdxWorkingDir + '/.sfdx').exists() && this.promptForReloadMetadatas == true ) {
    doRetrieve = Utils.userPromptOkCancel('Metadatas already existing in local project.\\nDo you want to fetch them again ? (if you don\\'t know, input N)', 5)
}
else {
    doRetrieve = true
}
`,
            codeNarcCallsNumber: 2
        },
        {
            sourceBefore: `
private doReplaceInFile(String fileName, def searchRegex, String replacementValue) {
    def baseURLFile = new File(fileName)
    if (baseURLFile.exists()) {
        String baseURLText = baseURLFile.text.replaceAll(searchRegex , { all , start , end -> start + replacementValue + end })
        if(baseURLFile.text != baseURLText) {
            baseURLFile.text = baseURLText
            Utils.printlnLog("- updated $fileName with $replacementValue using pattern $searchRegex")
        }
        else
            Utils.printlnLog("- identical $fileName with $replacementValue using pattern $searchRegex")
    }
    else
        Utils.printlnLog("- file not found for update: $fileName with $replacementValue using pattern $searchRegex")
}
`,
            sourceAfter: `
private doReplaceInFile(String fileName, def searchRegex, String replacementValue) {
    def baseURLFile = new File(fileName)
    if (baseURLFile.exists()) {
        String baseURLText = baseURLFile.text.replaceAll(searchRegex , { all , start , end -> start + replacementValue + end })
        if(baseURLFile.text != baseURLText) {
            baseURLFile.text = baseURLText
            Utils.printlnLog("- updated $fileName with $replacementValue using pattern $searchRegex")
        }
        else {
            Utils.printlnLog("- identical $fileName with $replacementValue using pattern $searchRegex")
        }
    }
    else {
        Utils.printlnLog("- file not found for update: $fileName with $replacementValue using pattern $searchRegex")
    }
}
`,
            codeNarcCallsNumber: 2
        },
        {
            sourceBefore: `
static getFileExtension(fileName) {
    if (fileName.lastIndexOf('.') != -1 && fileName.lastIndexOf('.') != 0) {
        return fileName.substring(fileName.lastIndexOf('.') + 1)
    }
    else return '' 
}
`,
            sourceAfter: `
static getFileExtension(fileName) {
    if (fileName.lastIndexOf('.') != -1 && fileName.lastIndexOf('.') != 0) {
        return fileName.substring(fileName.lastIndexOf('.') + 1)
    }
    else return '' 
}
`,
            codeNarcCallsNumber: 1
        }
    ]
};

module.exports = { rule };
