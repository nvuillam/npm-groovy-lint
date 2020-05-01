// Unnecessary package reference
const { getVariable, getVariableRange } = require("../utils");

const rule = {
    variables: [
        {
            name: "CLASS_WITH_PACKAGE",
            regex: /The (.*) (.*) was explicitly imported, so specifying the package name is not necessary/
        }
    ],
    range: {
        type: "function",
        func: (errLine, errItem, evaluatedVars) => {
            return getVariableRange(errLine, evaluatedVars, "CLASS_WITH_PACKAGE", errItem);
        }
    },
    fix: {
        label: "Use short name",
        type: "function",
        func: (line, evaluatedVars) => {
            const packageName = getVariable(evaluatedVars, "CLASS_WITH_PACKAGE", { mandatory: true, htmlToString: true, line: line });
            const packageShortName = packageName.split(".").pop();
            return line.replace(packageName, packageShortName);
        }
    },
    tests: [
        {
            sourceBefore: `
import groovy.json.JsonOutput

def body = groovy.json.JsonOutput.toJson(value)
`,
            sourceAfter: `
import groovy.json.JsonOutput

def body = JsonOutput.toJson(value)
`
        }
    ]
};

module.exports = { rule };
