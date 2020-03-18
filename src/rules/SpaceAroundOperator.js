// Space around operators

const { getVariable, getVariableRange, addSpaceAroundChar } = require("../utils");

const rule = {
    variables: [
        {
            name: "OPERATOR",
            regex: /The operator "(.*)" within class (.*) is not (.*) by a space or whitespace/
        }
    ],
    range: {
        type: "function",
        func: (errLine, errItem, evaluatedVars) => {
            return getVariableRange(errLine, evaluatedVars, "OPERATOR", errItem);
        }
    },
    fix: {
        label: "Add space around operator",
        type: "function",
        func: (line, evaluatedVars) => {
            let operator = getVariable(evaluatedVars, "OPERATOR", { mandatory: true, htmlToString: true, line: line });
            if (!line.includes("+=") && !line.includes("++") && !line.includes("--") && !line.includes("-=")) {
                return addSpaceAroundChar(line, operator);
            } else {
                return line;
            }
        }
    },
    tests: [
        {
            sourceBefore: `
class MyClass {
    def myMethod() {
        [1,2]as String
        { -> println 123 } as Runnable      // ok
        { -> println 456 } as
            Runnable
        { -> println 789
                } as Runnable
        (int)34.56                          // ignored
    }

    def myField = 'Toto'+'Titi'+'Tutu'
}
`,
            sourceAfter: `
class MyClass {
    def myMethod() {
        [1,2] as String
        { -> println 123 } as Runnable      // ok
        { -> println 456 } as
            Runnable
        { -> println 789
                } as Runnable
        (int)34.56                          // ignored
    }

    def myField = 'Toto' + 'Titi' + 'Tutu'
}
`
        }
    ]
};

module.exports = { rule };
