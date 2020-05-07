// Unnecessary dot class

const { getStringRange } = require("../utils");

const rule = {
    range: {
        type: "function",
        func: (errLine, errItem) => {
            return getStringRange(errLine, ".class", errItem);
        }
    },
    fix: {
        label: "Remove .class",
        type: "replaceString",
        before: ".class",
        after: ""
    },
    tests: [
        {
            sourceBefore: `
    def x = String.class
`,
            sourceAfter: `
    def x = String
`
        }
    ]
};

module.exports = { rule };
