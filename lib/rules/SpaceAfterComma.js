// Add space after a comma

const { getStringRange, addSpaceAfterChar } = require("../utils");

const rule = {
    range: {
        type: "function",
        func: (errLine, errItem) => {
            return getStringRange(errLine, ",", errItem);
        }
    },
    fix: {
        label: "Add space after comma",
        type: "function",
        func: line => {
            return addSpaceAfterChar(line, ",");
        }
    },
    tests: [
        {
            sourceBefore: `
def x = callFunction(toto,titi)
`,
            sourceAfter: `
def x = callFunction(toto, titi)
`
        },
        {
            sourceBefore: `
if (true) {
    def x = callFunction(toto,titi)
}
`,
            sourceAfter: `
if (true) {
    def x = callFunction(toto, titi)
}
`
        }
    ]
};

module.exports = { rule };
