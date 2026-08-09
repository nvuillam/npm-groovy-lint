// Unused method parameter

import { getVariableRange } from "../utils.js";

const rule = {
    variables: [
        {
            name: "PARAMNAME",
            regex: /Method parameter \[(.*)\] is never referenced in the method (.*) of class (.*)/,
            regexPos: 1,
        },
    ],
    range: {
        type: "function",
        func: (errLine, errItem, evaluatedVars) => {
            return getVariableRange(errLine, evaluatedVars, "PARAMNAME", errItem);
        },
    },
};

export { rule };
