// System.exit forbidden

import { getStringRange } from "../utils.js";

const rule = {
    range: {
        type: "function",
        func: (errLine, errItem) => {
            return getStringRange(errLine, "System.exit", errItem);
        },
    },
};

export { rule };
