// Space after switch

const { getStringRange } = require("../utils");

const rule = {
    range: {
        type: "function",
        func: (errLine, errItem) => {
            return getStringRange(errLine, "){", errItem);
        }
    },
    fix: {
        label: "Fix space after switch",
        type: "replaceString",
        before: "switch(",
        after: "switch ("
    },
    tests: [
        {
            sourceBefore: `
switch(a) {                                
    case 1: println 'one'
}
`,
            sourceAfter: `
switch (a) {                                
    case 1: println 'one'
}
`
        }
    ]
};

module.exports = { rule };
