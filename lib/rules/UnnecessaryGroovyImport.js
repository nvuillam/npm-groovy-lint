// Unnecessary Groovy Import

import { getVariable } from "../utils.js";

const rule = {
    scope: "file",
    unitary: true,
    fix: {
        label: "Remove unnecessary groovy import",
        type: "function",
        func: (allLines, variables) => {
            const lineNumber = getVariable(variables, "lineNb", { mandatory: true });
            if (allLines[lineNumber + 1].includes("import")) {
                allLines.splice(lineNumber + 1, 1);
            }
            return allLines;
        },
    },

    tests: [
        {
            sourceBefore: `
import java.io.InputStream
import java.io.OutputStream

class ABC {
    InputStream input
}
`,
            sourceAfter: `
import java.io.InputStream

class ABC {
    InputStream input
}
`,
        },
    ],
};

export { rule };
