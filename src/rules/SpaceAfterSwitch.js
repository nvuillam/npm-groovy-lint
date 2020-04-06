// Space after switch

const { getStringRange, addSpaceAfterChar } = require("../utils");

const rule = {
    range: {
        type: "function",
        func: (errLine, errItem) => {
            return getStringRange(errLine, "switch", errItem);
        }
    },
    fix: {
        label: "Add space after switch",
        type: "function",
        func: line => {
            return addSpaceAfterChar(line, "switch");
        }
    },
    tests: [
        {
            sourceBefore: `
if (a == 0) {
    switch(property.type) {
        case int:
            newPropertyValue = Integer.parseInt(propertyValue.trim())
            break
        case long:
            newPropertyValue = Long.parseLong(propertyValue.trim())
            break
    }
}
`,
            sourceAfter: `
if (a == 0) {
    switch (property.type) {
        case int:
            newPropertyValue = Integer.parseInt(propertyValue.trim())
            break
        case long:
            newPropertyValue = Long.parseLong(propertyValue.trim())
            break
    }
}
`
        }
    ]
};

module.exports = { rule };
