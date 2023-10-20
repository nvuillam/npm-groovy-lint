// Unnecessary Groovy String

const { getVariable, getVariableRange, findRangeBetweenStrings } = require("../utils");

const rule = {
    scope: "file",
    unitary: true,
    variables: [
        {
            name: "STRING",
            regex: /The String '([\s\S]*)' can be wrapped in single quotes instead of double quotes/
        }
    ],
    range: {
        type: "function",
        func: (errLine, errItem, evaluatedVars, allLines) => {
            // Single line range
            const singleLineRange = getVariableRange(errLine, evaluatedVars, "STRING", errItem);
            if (singleLineRange.start.character > -1) {
                return singleLineRange;
            } else {
                return findRangeBetweenStrings(allLines, errItem, '"""', '"""');
            }
        }
    },
    fix: {
        label: "Replace double quotes by single quotes",
        type: "function",
        func: (allLines, variables) => {
            const lineNumber = getVariable(variables, "lineNb", { mandatory: true });
            const range = getVariable(variables, "range", { mandatory: true });
            const str = getVariable(variables, "STRING", { mandatory: true });
            // Single line replacement: replace " by '
            if (range.start.line === range.end.line) {
                allLines[lineNumber] = allLines[lineNumber].replace(`"${str}"`, `'${str}'`);
            }
            // Multiline replacement: replace """ by '''
            else {
                allLines[range.start.line - 1] = allLines[range.start.line - 1].replace(`"""`, `'''`);
                allLines[range.end.line - 1] = allLines[range.end.line - 1].replace(`"""`, `'''`);
            }
            return allLines;
        }
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
        },
        {
            sourceBefore: `
def b = """
I am a string
"""
`,
            sourceAfter: `
def b = '''
I am a string
'''
`
        },
        {
            sourceBefore: `
def b = """
I am a string"""
`,
            sourceAfter: `
def b = '''
I am a string'''
`
        }
    ]
};

module.exports = { rule };
