// Unnecessary Groovy Import

const { getVariable } = require("../utils");

const rule = {
    scope: "file",
    fix: {
        label: "Remove unused groovy import",
        type: "function",
        func: (allLines, variables) => {
            const lineNumber = getVariable(variables, "lineNb", { mandatory: true });
            if (allLines[lineNumber].includes("import")) {
                allLines.splice(lineNumber, 1);
            }
            return allLines;
        }
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
`
        }
    ]
};

module.exports = { rule };
