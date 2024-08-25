// Space after while

import { getStringRange } from "../utils.js";

const rule = {
    range: {
        type: "function",
        func: (errLine, errItem) => {
            return getStringRange(errLine, "){", errItem);
        },
    },
    fix: {
        label: "Fix space after while",
        type: "replaceString",
        before: "while(",
        after: "while (",
    },
    tests: [
        {
            sourceBefore: `
int count = 0;
while(count<5) {
    println(count);
    count++;
}
`,
            sourceAfter: `
int count = 0;
while (count<5) {
    println(count);
    count++;
}
`,
        },
    ],
};

export { rule };
