// Too many methods in a class

import { getVariableRange } from "../utils.js";

const rule = {
    variables: [
        {
            name: "CLASSNAME",
            regex: /Class (.*) has 52 methods/,
            regexPos: 1,
        },
    ],
    range: {
        type: "function",
        func: (errLine, errItem, evaluatedVars) => {
            return getVariableRange(errLine, evaluatedVars, "CLASSNAME", errItem);
        },
    },
};

export { rule };
