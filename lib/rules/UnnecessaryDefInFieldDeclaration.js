// Unnecessary def in field declaration (static def)

const { getStringRange } = require("../utils");

const rule = {
    range: {
        type: "function",
        func: (errLine, errItem) => {
            return getStringRange(errLine, "def", errItem);
        }
    },
    fix: {
        label: "Remove def",
        type: "replaceString",
        before: "def ",
        after: ""
    },
    tests: [
        {
            sourceBefore: `
class lelamanul {
    def private str = "lelamanul"
}
`,
            sourceAfter: `
class lelamanul {
    private str = "lelamanul"
}
`
        },
        {
            sourceBefore: `
class lelamanul {
    def public str = "lelamanul"
}
`,
            sourceAfter: `
class lelamanul {
    public str = "lelamanul"
}
`
        }
    ]
};

module.exports = { rule };
