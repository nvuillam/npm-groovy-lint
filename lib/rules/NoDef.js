// No use of def

const { getStringRange } = require("../utils");

const rule = {
    range: {
        type: "function",
        func: (errLine, errItem) => {
            return getStringRange(errLine, "def", errItem);
        }
    }
};

module.exports = { rule };
