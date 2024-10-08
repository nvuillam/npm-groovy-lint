// Space after method call name

import { getStringRange } from "../utils.js";

const rule = {
    range: {
        type: "function",
        func: (errLine, errItem) => {
            return getStringRange(errLine, " (", errItem);
        },
    },
    fix: {
        label: "Remove space after method call name",
        type: "replaceString",
        before: " (",
        after: "(",
    },
    tests: [
        {
            sourceBefore: `
Utils.printlnLog ('-----')
`,
            sourceAfter: `
Utils.printlnLog('-----')
`,
        },
    ],
};

export { rule };
