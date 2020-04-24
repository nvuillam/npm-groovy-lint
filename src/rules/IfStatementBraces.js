// Missing if braces

// nvuillam: Fix not always working, especially when embedded missing If statements ...
//   let's let people correct that manually for now :)

const { getOutOfBracesStrings, getStringRange, getVariable, isValidCodeLine } = require("../utils");

const rule = {
    scope: "file",
    unitary: true,
    triggers: ["ClosingBraceNotAlone"],
    triggersAgainAfterFix: ["Indentation", "IndentationClosingBraces", "IndentationComments"],
    range: {
        type: "function",
        func: (errLine, errItem) => {
            return getStringRange(errLine, "if", errItem);
        }
    },
    fix: {
        label: "Add if statement braces",
        type: "function",
        func: (allLines, variables) => {
            const lineNumber = getVariable(variables, "lineNb", { mandatory: true });
            let line = allLines[lineNumber];
            // If next line is also a if/else, or if line does not contain if this rule can not auto-fix for now, it has to be done manually
            const nextLineAfterFoundOne = allLines[lineNumber + 1];
            if (
                (nextLineAfterFoundOne &&
                    (nextLineAfterFoundOne.includes("if (") || nextLineAfterFoundOne.includes("if(") || nextLineAfterFoundOne.includes("else {"))) ||
                line.includes(";") ||
                getOutOfBracesStrings(line, ["if"]).length > 0
            ) {
                return allLines;
            }
            // Check we are on the correct line to correct, if not trigger error
            if (!line.includes("if")) {
                throw new Error('Line does not contain "if" :' + line);
            }
            if (line.includes("{")) {
                throw new Error("Line already has an opening brace :" + line);
            }
            // Add opening brace to if line
            line = line.trimEnd() + " {";
            allLines[lineNumber] = line;
            // Add a tag ###NEWLINECLOSINGBRACE### to indicate rule ClosingBraceNotAlone to replace it by a closing brace & carriage return
            let match = false;
            let pos = 0;
            let level = 0;
            while (!match && pos < allLines.length) {
                let nextLine = allLines[lineNumber + pos + 1];
                if (isValidCodeLine(nextLine) && level === 0) {
                    if (!nextLine.trim().startsWith("if") && !nextLine.includes("{")) {
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
if (a == 1)
    whatever()
`,
            sourceAfter: `
if (a == 1) {
    whatever()
}
`,
            codeNarcCallsNumber: 2
        },
        {
            sourceBefore: `
if (new File(sfdxWorkingDir + '/.sfdx').exists() && this.promptForReloadMetadatas == true )
    doRetrieve = Utils.userPromptOkCancel('Metadatas already existing in local project.\\nDo you want to fetch them again ? (if you don\\'t know, input N)', 5)
else
    doRetrieve = true
`,
            sourceAfter: `
if (new File(sfdxWorkingDir + '/.sfdx').exists() && this.promptForReloadMetadatas == true ) {
    doRetrieve = Utils.userPromptOkCancel('Metadatas already existing in local project.\\nDo you want to fetch them again ? (if you don\\'t know, input N)', 5)
}
else
    doRetrieve = true
`,
            codeNarcCallsNumber: 2
        },
        {
            sourceBefore: `
if (allowCreation==true) {
    String scratchOrgSlctn ;
    if (this.scratchOrgUserEmail == null) 
        scratchOrgSlctn = Utils.userInputSelect('User input','Please select a scratch org number , or 0 to create a new scratch org : ',orgsChoiceList, 5);
    if (scratchOrgSlctn != null && scratchOrgSlctn != '' &&
        orgsChoiceMap[scratchOrgSlctn] != null && orgsChoiceMap[scratchOrgSlctn].alias != null &&
        orgsChoiceMap[scratchOrgSlctn].alias != '' && this.scratchOrgUserEmail == null) {
            // Select scratch org
            this.scratchOrgAlias = orgsChoiceMap[scratchOrgSlctn].alias ;
    } 
    else {
            // Create new scratch org
            if (this.scratchOrgUserEmail == null) {
                this.scratchOrgAlias = Utils.userInputText('Please enter the name of the new scratch org (without spaces or special characters, AND WITH YOUR NAME IN IT FOR GOD SAKE :) ', 5) 
                // Store choice if request in config file 
                if (Utils.userPromptOkCancel('Do you want this new scratch org to be your default one ? (in '+this.ownConfigFile+')', 5)) {
                    Utils.setPropInJsonFile(this.ownConfigFile,"scratchOrgAlias",this.scratchOrgAlias)
                }
            }
            // Define scratch org description as JSON
            if (true)
                this.defJsonCreation()
            doSomething()
    }
}
`,
            sourceAfter: `
if (allowCreation==true) {
    String scratchOrgSlctn ;
    if (this.scratchOrgUserEmail == null) {
        scratchOrgSlctn = Utils.userInputSelect('User input','Please select a scratch org number , or 0 to create a new scratch org : ',orgsChoiceList, 5);
    }
    if (scratchOrgSlctn != null && scratchOrgSlctn != '' &&
        orgsChoiceMap[scratchOrgSlctn] != null && orgsChoiceMap[scratchOrgSlctn].alias != null &&
        orgsChoiceMap[scratchOrgSlctn].alias != '' && this.scratchOrgUserEmail == null) {
        // Select scratch org
        this.scratchOrgAlias = orgsChoiceMap[scratchOrgSlctn].alias ;
        } 
    else {
        // Create new scratch org
        if (this.scratchOrgUserEmail == null) {
            this.scratchOrgAlias = Utils.userInputText('Please enter the name of the new scratch org (without spaces or special characters, AND WITH YOUR NAME IN IT FOR GOD SAKE :) ', 5) 
            // Store choice if request in config file 
            if (Utils.userPromptOkCancel('Do you want this new scratch org to be your default one ? (in '+this.ownConfigFile+')', 5)) {
                Utils.setPropInJsonFile(this.ownConfigFile,"scratchOrgAlias",this.scratchOrgAlias)
            }
        }
        // Define scratch org description as JSON
        if (true) {
            this.defJsonCreation()
        }
        doSomething()
    }
}
`,
            codeNarcCallsNumber: 2
        },
        {
            sourceBefore: `
if (a == 1 && ( x === 2) && something()) whatever()
`,
            sourceAfter: `
if (a == 1 && ( x === 2) && something()) whatever()
`,
            codeNarcCallsNumber: 1
        }
    ]
};

module.exports = { rule };
