// Space after catch

const { getStringRange, addSpaceAfterChar } = require("../utils");

const rule = {
    range: {
        type: "function",
        func: (errLine, errItem) => {
            return getStringRange(errLine, ",", errItem);
        }
    },
    fix: {
        label: "Fix space after if",
        type: "function",
        func: line => {
            return addSpaceAfterChar(line, "if");
        }
    },
    tests: [
        {
            sourceBefore: `
if  (true) {
    def a = 1
}
`,
            sourceAfter: `
if (true) {
    def a = 1
}
`
        },
        {
            sourceBefore: `
if(true) {
    def a = 1
}
`,
            sourceAfter: `
if (true) {
    def a = 1
}
`
        }
    ]
};

module.exports = { rule };
