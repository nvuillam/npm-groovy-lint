// Space after for

const { getStringRange, addSpaceAfterChar } = require("../utils");

const rule = {
    range: {
        type: "function",
        func: (errLine, errItem) => {
            return getStringRange(errLine, ",", errItem);
        }
    },
    fix: {
        label: "Fix space after for",
        type: "function",
        func: line => {
            return addSpaceAfterChar(line, "for");
        }
    },
    tests: [
        {
            sourceBefore: `
for  (int i in 1...2) {
    println(i);
}
`,
            sourceAfter: `
for (int i in 1...2) {
    println(i);
}
`
        },
        {
            sourceBefore: `
for(int i in 1...2) {
    println(i);
}
`,
            sourceAfter: `
for (int i in 1...2) {
    println(i);
}
`
        }
    ]
};

module.exports = { rule };