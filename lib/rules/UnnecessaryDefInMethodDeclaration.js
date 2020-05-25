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
static def getCommandLogAsObj(String command) {
    return Utils.fromJsonLogString(getCommandLog(command))
}
`,
            sourceAfter: `
static getCommandLogAsObj(String command) {
    return Utils.fromJsonLogString(getCommandLog(command))
}
`
        }
    ]
};

module.exports = { rule };
