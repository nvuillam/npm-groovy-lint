// Exception type must not be used
const { getStringRange } = require("../utils");

const rule = {
    range: {
        type: "function",
        func: (errLine, errItem) => {
            return getStringRange(errLine, "Exception", errItem);
        }
    }
};

module.exports = { rule };
