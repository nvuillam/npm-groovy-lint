// Unnecessary Parenthesis for method call with closure

import { getVariableRange } from "../utils.js";

const rule = {
    variables: [
        {
            name: "METHOD",
            regex: /Violation in (.*). Parentheses in the '(.*)' method call are unnecessary and can be removed./,
            regexPos: 2,
        },
    ],
    range: {
        type: "function",
        func: (errLine, errItem, evaluatedVars) => {
            return getVariableRange(errLine, evaluatedVars, "METHOD", errItem);
        },
    },
    fix: {
        label: "Remove unnecessary parenthesis",
        type: "replaceString",
        before: "{{METHOD}}()",
        after: "{{METHOD}}",
    },
    tests: [
        {
            sourceBefore: `
dirFile.eachFile() {
    dirs << it
}
`,
            sourceAfter: `
dirFile.eachFile {
    dirs << it
}
`,
        },
    ],
};

export { rule };
