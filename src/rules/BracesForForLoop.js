// Braces for for loop

const { getVariable, moveOpeningBracket, findRangeBetweenStrings } = require("../utils");

const rule = {
    scope: "file",
    unitary: true,
    range: {
        type: "function",
        func: (_errLine, errItem, _evaluatedVars, allLines) => {
            return findRangeBetweenStrings(allLines, errItem, "for", "{");
        }
    },
    fix: {
        label: "Move opening brace on the same line",
        type: "function",
        func: (allLines, variables) => {
            const lineNumber = getVariable(variables, "lineNb", { mandatory: true });
            if (!allLines[lineNumber].includes("{")) {
                return moveOpeningBracket(allLines, variables);
            }
            return allLines;
        }
    },
    tests: [
        {
            sourceBefore: `
for (int i = 0; i < toto.length ; i++)
{
    def a = 1
}
`,
            sourceAfter: `
for (int i = 0; i < toto.length ; i++) {
    def a = 1
}
`
        },
        {
            sourceBefore: `
for (int i = 0; i < toto.length ; i++)
{    def a = 1
}
`,
            sourceAfter: `
for (int i = 0; i < toto.length ; i++) {
    def a = 1
}
`
        },
        {
            sourceBefore: `
for (int i = 0; i < toto.length ; i++) {
    def a = 1
}
`,
            sourceAfter: `
for (int i = 0; i < toto.length ; i++) {
    def a = 1
}
`
        }
    ]
};

module.exports = { rule };
