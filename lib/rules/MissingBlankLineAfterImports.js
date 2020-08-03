// Missing blank lines after import

const { getVariable } = require("../utils");

const rule = {
    scope: "file",
    unitary: true,
    fix: {
        label: "Add blank line after imports",
        type: "function",
        func: (allLines, variables) => {
            const lineNumber = getVariable(variables, "lineNb", { mandatory: true });
            allLines.splice(lineNumber, 0, "");
            return allLines;
        }
    },
    tests: [
        {
            sourceBefore: `
import a.b.c.D
import g.eeee.f.g.Hhhhh
import g.eeee.f.g.Iiii
def a = 1
`,
            sourceAfter: `
import a.b.c.D
import g.eeee.f.g.Hhhhh
import g.eeee.f.g.Iiii

def a = 1
`
        }
    ]
};

module.exports = { rule };
