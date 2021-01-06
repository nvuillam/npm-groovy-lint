// No use of Java.io classes

const { getLastVariableRange } = require("../utils");

//NV: TODO: finalise for when there is several occurrences of the string in the same line
const rule = {
    disabled: true,
    variables: [
        {
            name: "CLASSNAME",
            regex: /The use of java.io.(.*) violates the Enterprise Java Bean specification/,
            regexPos: 1
        }
    ],
    range: {
        type: "function",
        func: (errLine, errItem, evaluatedVars) => {
            return getLastVariableRange(errLine, evaluatedVars, "CLASSNAME", errItem);
        }
    }
};

module.exports = { rule };
