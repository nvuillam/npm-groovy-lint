// Too many methods in a class

const { getVariableRange } = require("../utils");

const rule = {
    variables: [
        {
            name: "METHODNAME",
            regex: /"(.*)" parameter of "(.*)" method is dynamically typed/,
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
