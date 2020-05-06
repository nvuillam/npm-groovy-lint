// Braces for method

const { moveOpeningBracket, findRangeBetweenStrings, getVariable } = require("../utils");

const rule = {
    scope: "file",
    variables: [
        {
            name: "METHOD_NAME",
            regex: /Opening brace for the method (.*) should start on the same line/
        }
    ],
    range: {
        type: "function",
        func: (_errLine, errItem, evaluatedVars, allLines) => {
            const methodName = getVariable(evaluatedVars, "METHOD_NAME", { mandatory: true });
            return findRangeBetweenStrings(allLines, errItem, methodName, "{");
        }
    },
    fix: {
        label: "Move opening brace on the same line",
        type: "function",
        func: (allLines, variables) => {
            return moveOpeningBracket(allLines, variables);
        }
    },
    tests: [
        {
            sourceBefore: `
def someMethodName (String toto)
{
    def a = 1
}
`,
            sourceAfter: `
def someMethodName (String toto) {
    def a = 1
}
`
        },
        {
            sourceBefore: `
def someMethodName (String toto)
{    def a = 1
}
`,
            sourceAfter: `
def someMethodName (String toto) {
    def a = 1
}
`
        } /*
        NV: Disable fix while not detected by CodeNarc
        ,
        {
            sourceBefore: `
def someMethodName (String toto,
                    String tata,
                    String tutu )
{   
    def a = 1
}
`,
            sourceAfter: `
def someMethodName (String toto,
                    String tata,
                    String tutu ) {   
    def a = 1
}
`
        } */
    ]
};

module.exports = { rule };
