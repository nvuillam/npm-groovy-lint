// Assignment in condition

const { getStringRange } = require("../utils");

const rule = {
    range: {
        type: "function",
        func: (errLine, errItem) => {
            return getStringRange(errLine, /(?<!=|!|>|<)=(?!=)/g, errItem);
        }
    },
    fix: {
        label: `Replace "=" by "=="`,
        type: "replaceString",
        before: /(?<!=|!|>|<)=(?!=)/g,
        after: "=="
    },
    tests: [
        {
            sourceBefore: `
if ((value = true)) {
    println 'should be =='
}

while (value = true) {
    println 'should be =='
}

while (value = true && value != false) {
    println 'should be =='
}

(value = true) ? x : y
(value = true) ?: x
`,
            sourceAfter: `
if ((value == true)) {
    println 'should be =='
}

while (value == true) {
    println 'should be =='
}

while (value == true && value != false) {
    println 'should be =='
}

(value == true) ? x : y
(value == true) ?: x
`
        }
    ]
};

module.exports = { rule };
