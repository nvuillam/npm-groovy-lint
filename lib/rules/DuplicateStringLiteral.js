// Duplicate string literal

import { getVariableRange } from "../utils.js";

const rule = {
    variables: [
        {
            name: "STRING_LITERAL",
            regex: /Duplicate String Literal: (.*)/,
            regexPos: 1,
        },
    ],
    range: {
        type: "function",
        func: (errLine, errItem, evaluatedVars) => {
            return getVariableRange(errLine, evaluatedVars, "STRING_LITERAL", errItem);
        },
    },
};

export { rule };
