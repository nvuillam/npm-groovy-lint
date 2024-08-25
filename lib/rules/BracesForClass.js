// Braces for class

import { moveOpeningBracket, findRangeBetweenStrings } from "../utils.js";

const rule = {
    scope: "file",
    unitary: true,
    range: {
        type: "function",
        func: (_errLine, errItem, _evaluatedVars, allLines) => {
            return findRangeBetweenStrings(allLines, errItem, "class", "{");
        },
    },
    fix: {
        label: "Move opening brace on the same line",
        type: "function",
        func: (allLines, variables) => {
            return moveOpeningBracket(allLines, variables);
        },
    },
    tests: [
        {
            sourceBefore: `
public class lelamanul
{
    def a = 1
}
`,
            sourceAfter: `
public class lelamanul {
    def a = 1
}
`,
        },
        {
            sourceBefore: `
public class lelamanul
{    def a = 1
}
`,
            sourceAfter: `
public class lelamanul {
    def a = 1
}
`,
        },
    ],
};

export { rule };
