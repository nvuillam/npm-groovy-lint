// File ends without new line
const os = require("os");

const rule = {
    scope: "file",

    fix: {
        label: "Add new line at the end of file",
        type: "function",
        func: allLines => {
            return (allLines.join(os.EOL) + os.EOL).split(os.EOL);
        }
    },
    tests: [
        {
            sourceBefore: `
def a = 1
def b = 2`,
            sourceAfter: `
def a = 1
def b = 2
`
        }
    ]
};

module.exports = { rule };
