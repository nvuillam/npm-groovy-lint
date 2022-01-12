// Too many methods in a class

const { getVariableRange } = require("../utils");

const rule = {
    variables: [
        {
            name: "METHODNAME",
            regex: /Method "(.*)" has a dynamic return type/,
            regexPos: 1
        }
    ],
    range: {
        type: "function",
        func: (errLine, errItem, evaluatedVars) => {
            return getVariableRange(errLine, evaluatedVars, "METHODNAME", errItem);
        }
    }
};

module.exports = { rule };
