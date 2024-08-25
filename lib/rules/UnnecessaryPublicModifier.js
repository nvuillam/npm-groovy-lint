// Variable type required
import { getStringRange } from "../utils.js";

const rule = {
    range: {
        type: "function",
        func: (errLine, errItem) => {
            return getStringRange(errLine, "public", errItem);
        },
    },
};

export { rule };
