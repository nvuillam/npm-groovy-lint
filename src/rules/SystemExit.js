// System.exit forbidden

const { getVariableRange } = require("../utils");

const rule = {
    range: {
        type: "function",
        func: (errLine, errItem, evaluatedVars) => {
            return getVariableRange(errLine, evaluatedVars, "System.exit", errItem);
        }
    }
};

module.exports = { rule };
