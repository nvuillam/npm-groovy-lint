// Unnecessary return keyword

const { getStringRange } = require("../utils");

const rule = {
    range: {
        type: "function",
        func: (errLine, errItem) => {
            return getStringRange(errLine, /return\s*/, errItem);
        }
    },
    fix: {
        label: "Remove return",
        type: "replaceString",
        before: /return\s*/,
        after: ""
    },
    tests: [
        {
            sourceBefore: `
    def foo() {
        def x = "thing"
        return x
    }
`,
            sourceAfter: `
    def foo() {
        def x = "thing"
        x
    }
`
        }
    ]
};

module.exports = { rule };
