// No use of Java.util.date

const { getStringRange } = require("../utils");

const rule = {
    range: {
        type: "function",
        func: (errLine, errItem) => {
            return getStringRange(errLine, "Date", errItem);
        }
    }
};

module.exports = { rule };
