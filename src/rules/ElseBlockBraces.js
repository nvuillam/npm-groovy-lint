// Missing else braces
const { getStringRangeMultiline } = require("../utils");

const rule = {
    scope: "file",
    unitary: true,
    triggers: ["ClosingBraceNotAlone"],
    range: {
        type: "function",
        func: (errLine, errItem) => {
            return getStringRangeMultiline(errLine, "else", errItem);
        }
    }
    /*
    fix: {
        label: "Add braces",
        type: "function",
        func: (allLines, variables) => {
            const lineNumber = getVariable(variables, "lineNb", { mandatory: true });
            // If next line is also a if/else, this rule can not autofix for now, it has to be done manually
            if (allLines[lineNumber + 1] && lineNumber[lineNumber + 1].includes("else")) {
                return allLines;
            }
            let line = allLines[lineNumber];
            line = line.trimEnd() + " {";
            allLines[lineNumber] = line;
            // next line
            let match = false;
            let pos = 0;
            let level = 0;
            while (!match && pos < allLines.length) {
                let nextLine = allLines[lineNumber + pos + 1];
                if (isValidCodeLine(nextLine) && level === 0) {
                    if (!nextLine.trim().startsWith("if") && !nextLine.includes("{")) {
                        nextLine = nextLine + "{{{NEWLINECLOSINGBRACE}}}";
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
    }*/
};

module.exports = { rule };
