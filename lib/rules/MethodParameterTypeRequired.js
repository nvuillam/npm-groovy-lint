// Too many methods in a class

import { getVariableRange } from "../utils.js";

const rule = {
    variables: [
        {
            name: "METHODNAME",
            regex: /"(.*)" parameter of "(.*)" method is dynamically typed/,
            regexPos: 1,
        },
    ],
    range: {
        type: "function",
        func: (errLine, errItem, evaluatedVars) => {
            return getVariableRange(errLine, evaluatedVars, "METHODNAME", errItem);
        },
    },
};

export { rule };
