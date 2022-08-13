// Duplicate number literal

const { getVariableRange } = require("../utils");

const rule = {
    variables: [
        {
            name: "NUMBER_LITERAL",
            regex: /Duplicate Number Literal: (.*)/,
            regexPos: 1
        }
    ],
    range: {
        type: "function",
        func: (errLine, errItem, evaluatedVars) => {
            return getVariableRange(errLine, evaluatedVars, "NUMBER_LITERAL", errItem);
        }
    }
};

module.exports = { rule };
