// Unnecessary toString()

import { getStringRange } from "../utils.js";

const rule = {
    range: {
        type: "function",
        func: (errLine, errItem) => {
            return getStringRange(errLine, ".toString()", errItem);
        },
    },
    fix: {
        label: "Remove unnecessary toString()",
        type: "function",
        func: (line) => {
            return line.replace(".toString()", "");
        },
    },
    tests: [
        {
            sourceBefore: `
String str = 'lelamanul'
String str2 = str.toString()
`,
            sourceAfter: `
String str = 'lelamanul'
String str2 = str
`,
        },
    ],
};

export { rule };
