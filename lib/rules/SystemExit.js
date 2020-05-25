// System.exit forbidden

const { getStringRange } = require("../utils");

const rule = {
    range: {
        type: "function",
        func: (errLine, errItem) => {
            return getStringRange(errLine, "System.exit", errItem);
        }
    }
};

module.exports = { rule };
