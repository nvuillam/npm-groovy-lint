// Add space after a semicolon

const { getStringRange, addSpaceAfterChar } = require("../utils");

const rule = {
    range: {
        type: "function",
        func: (errLine, errItem) => {
            return getStringRange(errLine, ";", errItem);
        }
    },
    fix: {
        label: "Add space after semicolon",
        type: "function",
        func: line => {
            return addSpaceAfterChar(line, ";");
        }
    },
    tests: [
        {
            sourceBefore: `
for (int i=0;i * 10;i++) {                  
    for (int j=0; j * 10;j++) { }           
}
`,
            sourceAfter: `
for (int i=0; i * 10; i++) {                  
    for (int j=0; j * 10; j++) { }           
}
`
        }
    ]
};

module.exports = { rule };
