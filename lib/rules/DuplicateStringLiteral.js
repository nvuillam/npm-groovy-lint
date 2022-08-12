// Duplicate string literal

const { getVariableRange } = require("../utils");

const rule = {
    variables: [
        {
            name: "STRING_LITERAL",
            regex: /Duplicate String Literal: (.*)/,
            regexPos: 1
        }
    ],
    range: {
        type: "function",
        func: (errLine, errItem, evaluatedVars) => {
            return getVariableRange(errLine, evaluatedVars, "STRING_LITERAL", errItem);
        }
    }
};

module.exports = { rule };
