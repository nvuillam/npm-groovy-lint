// Unnecessary semi colon at the end of a line

const { getLastStringRange } = require("../utils");

const rule = {
    range: {
        type: "function",
        func: (errLine, errItem) => {
            return getLastStringRange(errLine, ";", errItem);
        }
    },
    fix: {
        label: "Remove unnecessary semicolon",
        type: "function",
        func: line => {
            if ((line.match(/;/g) || []).length === 1) {
                line = line.split(";").join("");
            }
            return line;
        }
    },
    tests: [
        {
            sourceBefore: `
String str = 'lelamanul';
`,
            sourceAfter: `
String str = 'lelamanul'
`
        }
    ]
};

module.exports = { rule };
