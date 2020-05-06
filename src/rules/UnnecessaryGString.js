// Unnecessary Groovy String

const { getVariableRange } = require("../utils");

const rule = {
    variables: [
        {
            name: "STRING",
            regex: /The String '(.*)' can be wrapped in single quotes instead of double quotes/
        }
    ],
    range: {
        type: "function",
        func: (errLine, errItem, evaluatedVars) => {
            return getVariableRange(errLine, evaluatedVars, "STRING", errItem);
        }
    },
    fix: {
        label: "Replace double quotes by single quotes",
        type: "replaceString",
        before: '"{{STRING}}"',
        after: "'{{STRING}}'"
    },
    tests: [
        {
            sourceBefore: `
String str = "lelamanul"
`,
            sourceAfter: `
String str = 'lelamanul'
`
        },
        {
            sourceBefore: `
String str = 'lelamanul' + "\\n"
`,
            sourceAfter: `
String str = 'lelamanul' + '\\n'
`
        },
        {
            sourceBefore: `
String str = 'lelamanul' + "\\n\\r"
`,
            sourceAfter: `
String str = 'lelamanul' + '\\n\\r'
`
        },
        {
            sourceBefore: `
String str = 'lelamanul' + "\\n\\r\\n" + "titi\\n" + "\\n\\r" + "lelamanul\\nwesh"
`,
            sourceAfter: `
String str = 'lelamanul' + '\\n\\r\\n' + 'titi\\n' + '\\n\\r' + 'lelamanul\\nwesh'
`
        }
    ]
};

module.exports = { rule };
