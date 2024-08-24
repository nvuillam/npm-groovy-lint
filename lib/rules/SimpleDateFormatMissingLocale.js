// Simple Date Format missing locale

const { getStringRange } = require("../utils");

const rule = {
    range: {
        type: "function",
        func: (errLine, errItem) => {
            return getStringRange(errLine, "new SimpleDateFormat", errItem);
        },
    },
};

export default  { rule };
