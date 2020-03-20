// Unused import

const { getVariable } = require("../utils");

const rule = {
    scope: "file",
    unitary: true,
    fix: {
        label: "Remove blank line before end of the block",
        type: "function",
        func: (allLines, variables) => {
            const lineNumber = getVariable(variables, "lineNb", { mandatory: true });
            if (allLines[lineNumber].trim() === "") {
                allLines.splice(lineNumber, 1);
            }
            return allLines;
        }
    },

    tests: [
        {
            sourceBefore: `
if (true) {
    def a = 1

}

if (false) {
    def b = 2

}
`,
            sourceAfter: `
if (true) {
    def a = 1
}

if (false) {
    def b = 2
}
`
        }
    ]
};

module.exports = { rule };
