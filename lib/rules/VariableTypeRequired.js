// Variable type required
const { getVariableRange } = require("../utils");

const rule = {
    variables: [
        {
            name: "VARIABLE_NAME",
            regex: /The type is not specified for variable "(.*)"/
        }
    ],
    range: {
        type: "function",
        func: (errLine, errItem, evaluatedVars) => {
            return getVariableRange(errLine, evaluatedVars, "VARIABLE_NAME", errItem);
        }
    },
    rangeTests: [
        {
            source: `
def returnCode = 0
`,
            expectedRange: {
                start: {
                    line: 2,
                    character: 4
                },
                end: {
                    line: 2,
                    character: 14
                }
            }
        }
    ]
};

module.exports = { rule };
