// Exception type must not be used
import { getStringRange } from "../utils.js";

const rule = {
    range: {
        type: "function",
        func: (errLine, errItem) => {
            return getStringRange(errLine, "Exception", errItem);
        },
    },
};

export { rule };
