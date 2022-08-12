// No space between parenthesis

const { getStringRange } = require("../utils");

const rule = {
    range: {
        type: "function",
        func: (errLine, errItem) => {
            let parenthesisRange = getStringRange(errLine, "( ", errItem);
            if (parenthesisRange.start.character < 0) {
                parenthesisRange = getStringRange(errLine, " )", errItem);
            }
            return parenthesisRange;
        }
    },
    rangeTests: [
        {
            source: `
def res = uuuurf( "yessss")
`,
            expectedRange: {
                start: {
                    line: 2,
                    character: 16
                },
                end: {
                    line: 2,
                    character: 18
                }
            }
        },
        {
            source: `
def res = uuuurf("yessss" )
`,
            expectedRange: {
                start: {
                    line: 2,
                    character: 25
                },
                end: {
                    line: 2,
                    character: 27
                }
            }
        }
    ]
};

module.exports = { rule };
