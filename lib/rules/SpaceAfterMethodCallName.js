// Space after method call name

const { getStringRange } = require("../utils");

const rule = {
    range: {
        type: "function",
        func: (errLine, errItem) => {
            return getStringRange(errLine, " (", errItem);
        }
    },
    fix: {
        label: "Remove space after method call name",
        type: "replaceString",
        before: " (",
        after: "("
    },
    tests: [
        {
            sourceBefore: `
Utils.printlnLog ('-----')
`,
            sourceAfter: `
Utils.printlnLog('-----')
`
        }
    ]
};

module.exports = { rule };
