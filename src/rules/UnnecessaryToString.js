// Unnecessary toString()

const { getStringRange } = require("../utils");

const rule = {
    range: {
        type: "function",
        func: (errLine, errItem) => {
            return getStringRange(errLine, ".toString()", errItem);
        }
    },
    fix: {
        label: "Remove unnecessary toString()",
        type: "function",
        func: line => {
            return line.replace(".toString()", "");
        }
    },
    tests: [
        {
            sourceBefore: `
String str = 'lelamanul'
String str2 = str.toString()
`,
            sourceAfter: `
String str = 'lelamanul'
String str2 = str
`
        }
    ]
};

module.exports = { rule };
