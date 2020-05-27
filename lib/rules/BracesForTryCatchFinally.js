// Braces for try catch finally

const { moveOpeningBracket, findRangeBetweenStrings } = require("../utils");

const rule = {
    scope: "file",
    unitary: true,
    range: {
        type: "function",
        func: (_errLine, errItem, _evaluatedVars, allLines) => {
            return findRangeBetweenStrings(allLines, errItem, "try", "{");
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
try
{
    def a = 1
} catch (Throwable t) {
    def b = 3
} finally {
    def c = 6
}
`,
            sourceAfter: `
try {
    def a = 1
} catch (Throwable t) {
    def b = 3
} finally {
    def c = 6
}
`
        }
    ]
};

module.exports = { rule };
