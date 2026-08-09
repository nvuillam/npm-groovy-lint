// Simple Date Format missing locale

import { getStringRange } from "../utils.js";

const rule = {
    range: {
        type: "function",
        func: (errLine, errItem) => {
            return getStringRange(errLine, "new SimpleDateFormat", errItem);
        },
    },
};

export { rule };
