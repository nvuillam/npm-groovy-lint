// Add space after a semicolon

import { getStringRange, addSpaceAfterChar } from "../utils.js";

const rule = {
    range: {
        type: "function",
        func: (errLine, errItem) => {
            return getStringRange(errLine, ";", errItem);
        },
    },
    fix: {
        label: "Add space after semicolon",
        type: "function",
        func: (line) => {
            return addSpaceAfterChar(line, ";");
        },
    },
    tests: [
        {
            sourceBefore: `
for (int i=0;i * 10;i++) { }
`,
            sourceAfter: `
for (int i=0; i * 10; i++) { }
`,
        },
    ],
};

export { rule };
