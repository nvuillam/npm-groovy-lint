// Braces for if else

const { findRangeBetweenStrings } = require("../utils");

const rule = {
    range: {
        type: "function",
        func: (_errLine, errItem, _evaluatedVars, allLines) => {
            return findRangeBetweenStrings(allLines, errItem, "if", "{");
        }
    }
};

module.exports = { rule };
