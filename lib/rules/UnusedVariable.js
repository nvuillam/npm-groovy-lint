// Unused variable

import { getVariableRange } from "../utils.js";

const rule = {
    variables: [
        {
            name: "VARNAME",
            regex: /The variable \[(.*)\] in (.*) is not used/,
        },
    ],
    range: {
        type: "function",
        func: (errLine, errItem, evaluatedVars) => {
            return getVariableRange(errLine, evaluatedVars, "VARNAME", errItem);
        },
    },
};

export { rule };
