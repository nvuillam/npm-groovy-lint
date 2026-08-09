// No use of Java.util.date

import { getStringRange } from "../utils.js";

const rule = {
    range: {
        type: "function",
        func: (errLine, errItem) => {
            return getStringRange(errLine, "Date", errItem);
        },
    },
};

export { rule };
