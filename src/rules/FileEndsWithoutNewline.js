// File ends without new line

const rule = {
    scope: "file",

    fix: {
        label: "Add new line at the end of file",
        type: "function",
        func: allLines => {
            return (allLines.join("\r\n") + "\r\n").split("\r\n");
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
