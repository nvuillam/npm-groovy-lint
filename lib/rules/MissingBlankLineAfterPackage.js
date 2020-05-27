// Missing blank lines after package

const { getVariable } = require("../utils");

const rule = {
    scope: "file",
    unitary: true,
    fix: {
        label: "Add blank line after package",
        type: "function",
        func: (allLines, variables) => {
            const lineNumber = getVariable(variables, "lineNb", { mandatory: true });
            allLines.splice(lineNumber + 1, 0, "");
            return allLines;
        }
    },
    tests: [
        {
            sourceBefore: `
package com.lelama.nul
import a.b.c.D
import g.eeee.f.g.Hhhhh
import g.eeee.f.g.Iiii
`,
            sourceAfter: `
package com.lelama.nul

import a.b.c.D
import g.eeee.f.g.Hhhhh
import g.eeee.f.g.Iiii
`
        }
    ]
};

module.exports = { rule };
