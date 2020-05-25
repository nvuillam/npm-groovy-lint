// Space after for
const { getStringRange, addSpaceAfterChar } = require("../utils");

const rule = {
    range: {
        type: "function",
        func: (errLine, errItem) => {
            return getStringRange(errLine, "for", errItem);
        }
    },
    fix: {
        label: "Add space after for",
        type: "function",
        func: line => {
            return addSpaceAfterChar(line, "for");
        }
    },
    tests: [
        {
            sourceBefore: `
for(child in this.children) {
    def foundResults = child.findResultsForPath(path)
    if (foundResults) {
        return foundResults
    }
}
`,
            sourceAfter: `
for (child in this.children) {
    def foundResults = child.findResultsForPath(path)
    if (foundResults) {
        return foundResults
    }
}
`
        }
    ]
};

module.exports = { rule };
