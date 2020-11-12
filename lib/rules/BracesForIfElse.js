// Braces for if else

const { moveOpeningBracket, findRangeBetweenStrings } = require("../utils");

const rule = {
    scope: "file",
    unitary: true,
    range: {
        type: "function",
        func: (_errLine, errItem, _evaluatedVars, allLines) => {
            return findRangeBetweenStrings(allLines, errItem, "if", "{");
        }
    },
    fix: {
        label: "Move opening brace on the same line",
        type: "function",
        func: (allLines, variables) => {
            return moveOpeningBracket(allLines, variables);
        }
    },
    tests: [
        {
            sourceBefore: `
if (true)
{
    def a = 1
}
`,
            sourceAfter: `
if (true) {
    def a = 1
}
`
        },
        {
            sourceBefore: `
if (true)
{    def a = 1
}
`,
            sourceAfter: `
if (true) {
    def a = 1
}
`
        },
        {
            sourceBefore: `
if (true &&
    true &&
    true )
{
    def a = 1
}
`,
            sourceAfter: `
if (true &&
    true &&
    true ) {
    def a = 1
}
`
        }
    ]
};

module.exports = { rule };
