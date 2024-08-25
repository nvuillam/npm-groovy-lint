// Variable name invalid
import { getVariableRange } from "../utils.js";

const rule = {
    variables: [
        {
            name: "VARIABLE_NAME",
            regex: /Variable named (.*) in (.*) does not match the pattern (.*)/,
        },
    ],
    range: {
        type: "function",
        func: (errLine, errItem, evaluatedVars) => {
            return getVariableRange(errLine, evaluatedVars, "VARIABLE_NAME", errItem);
        },
    },
    rangeTests: [
        {
            source: `
def RANDOM_ID = 0
`,
            expectedRange: {
                start: {
                    line: 2,
                    character: 4,
                },
                end: {
                    line: 2,
                    character: 13,
                },
            },
        },
    ],
};

export { rule };
