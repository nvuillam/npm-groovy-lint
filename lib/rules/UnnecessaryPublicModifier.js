// Variable type required
const { getStringRange } = require("../utils");

const rule = {
    range: {
        type: "function",
        func: (errLine, errItem) => {
            return getStringRange(errLine, "public", errItem);
        }
    }
};

module.exports = { rule };
