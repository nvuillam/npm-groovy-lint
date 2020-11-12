// Unused method parameter

const { getVariableRange } = require("../utils");

const rule = {
    variables: [
        {
            name: "PARAMNAME",
            regex: /Method parameter \[(.*)\] is never referenced in the method (.*) of class (.*)/,
            regexPos: 1
        }
    ],
    range: {
        type: "function",
        func: (errLine, errItem, evaluatedVars) => {
            return getVariableRange(errLine, evaluatedVars, "PARAMNAME", errItem);
        }
    }
};

module.exports = { rule };
