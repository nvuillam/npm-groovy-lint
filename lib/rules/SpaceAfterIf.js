// Space after if

const { getStringRange, addSpaceAfterChar } = require("../utils");

const rule = {
    range: {
        type: "function",
        func: (errLine, errItem) => {
            return getStringRange(errLine, "if", errItem);
        }
    },
    fix: {
        label: "Add space after if",
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
        },
        {
            sourceBefore: `
if(lifetime) {
    def a = 1
}
`,
            sourceAfter: `
if (lifetime) {
    def a = 1
}
`
        }
    ]
};

module.exports = { rule };
