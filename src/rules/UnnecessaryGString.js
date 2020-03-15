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
        }
    ]
};

module.exports = { rule };
