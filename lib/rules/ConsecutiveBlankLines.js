// Consecutive blank lines

import { getVariable } from "../utils.js";

const rule = {
    scope: "file",
    fix: {
        label: "Remove consecutive blank lines",
        type: "function",
        func: (allLines, variables) => {
            const lineNumber = getVariable(variables, "lineNb", { mandatory: true });
            const newFileLines = [];
            let prevLine = "none";
            let pos = 0;
            for (const line of allLines) {
                // Check if previous line is empty: if not do not add line
                if (line.trim() === "" && prevLine.trim() === "" && pos >= lineNumber) {
                    pos++;
                    continue;
                }
                newFileLines.push(line);
                prevLine = line;
                pos++;
            }
            return newFileLines;
        },
    },
    tests: [
        {
            sourceBefore: `
if (a == 2){


x = 1
}`,
            sourceAfter: `
if (a == 2){

x = 1
}`,
        },
        {
            sourceBefore: `
if (a == 2){




x = 1
}`,
            sourceAfter: `
if (a == 2){

x = 1
}`,
        },
    ],
};

export { rule };
