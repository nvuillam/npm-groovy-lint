// Unnecessary private on final method

import { getStringRange } from "../utils.js";

const rule = {
    range: {
        type: "function",
        func: (errLine, errItem) => {
            return getStringRange(errLine, "final", errItem);
        },
    },
    fix: {
        label: "Remove private",
        type: "replaceString",
        before: "final ",
        after: "",
    },
    tests: [
        {
            sourceBefore: `
    private final methodName() {

    }
`,
            sourceAfter: `
    private methodName() {

    }
`,
        },
    ],
};

export { rule };
