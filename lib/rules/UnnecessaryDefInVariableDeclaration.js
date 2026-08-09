// Unnecessary def in variable declaration

import { getStringRange } from "../utils.js";

const rule = {
    range: {
        type: "function",
        func: (errLine, errItem) => {
            return getStringRange(errLine, "def", errItem);
        },
    },
    fix: {
        label: "Remove def",
        type: "replaceString",
        before: "def ",
        after: "",
    },
    tests: [
        {
            sourceBefore: `
    def private string1 = 'example'
`,
            sourceAfter: `
    private string1 = 'example'
`,
        },
        {
            sourceBefore: `
    def final string5 = 'example'
`,
            sourceAfter: `
    final string5 = 'example'
`,
        },
        {
            sourceBefore: `
    def String string6 = 'example'
`,
            sourceAfter: `
    String string6 = 'example'
`,
        },
    ],
};

export { rule };
