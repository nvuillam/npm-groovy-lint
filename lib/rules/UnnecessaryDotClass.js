// Unnecessary dot class

import { getStringRange } from "../utils.js";

const rule = {
    range: {
        type: "function",
        func: (errLine, errItem) => {
            return getStringRange(errLine, ".class", errItem);
        },
    },
    fix: {
        label: "Remove .class",
        type: "replaceString",
        before: ".class",
        after: "",
    },
    tests: [
        {
            sourceBefore: `
    def x = String.class
`,
            sourceAfter: `
    def x = String
`,
        },
    ],
};

export { rule };
