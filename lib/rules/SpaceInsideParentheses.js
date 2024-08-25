// No space between parenthesis

import { getStringRange } from "../utils.js";

const rule = {
    fix: {
        label: "Remove spaces inside parenthesis",
        type: "function",
        func: (line) => {
            line = line.replace(/\( +/g, "(");
            line = line.replace(/ +\)/g, ")");
            return line;
        },
    },
    tests: [
        {
            sourceBefore: `
Utils.printlnLog( Utils.getExternalValue(globalKeyName))
Utils.printlnLog(Utils.getExternalValue(globalKeyName) )
Utils.printlnLog(Utils.getExternalValue(  globalKeyName) )
`,
            sourceAfter: `
Utils.printlnLog(Utils.getExternalValue(globalKeyName))
Utils.printlnLog(Utils.getExternalValue(globalKeyName))
Utils.printlnLog(Utils.getExternalValue(globalKeyName))
`,
        },
    ],
    range: {
        type: "function",
        func: (errLine, errItem) => {
            let parenthesisRange = getStringRange(errLine, "( ", errItem);
            if (parenthesisRange.start.character < 0) {
                parenthesisRange = getStringRange(errLine, " )", errItem);
            }
            return parenthesisRange;
        },
    },
    rangeTests: [
        {
            source: `
def res = uuuurf( "yessss")
`,
            expectedRange: {
                start: {
                    line: 2,
                    character: 16,
                },
                end: {
                    line: 2,
                    character: 18,
                },
            },
        },
        {
            source: `
def res = uuuurf("yessss" )
`,
            expectedRange: {
                start: {
                    line: 2,
                    character: 25,
                },
                end: {
                    line: 2,
                    character: 27,
                },
            },
        },
    ],
};

export { rule };
