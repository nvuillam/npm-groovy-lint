// Duplicate import

const { getVariable } = require("../utils");

const rule = {
    scope: "file",
    unitary: true,
    fix: {
        label: "Remove duplicate import",
        type: "function",
        func: (allLines, variables) => {
            const lineNumber = getVariable(variables, "lineNb", { mandatory: true });
            if (allLines[lineNumber].includes("import")) {
                allLines.splice(lineNumber, 1);
            } else {
                throw new Error(`FIX ERROR: Duplicate Import not found at at position ${lineNumber}`);
            }
            return allLines;
        }
    },

    tests: [
        {
            sourceBefore: `
import java.util.regex.Matcher
import javax.swing.JFileChooser
import java.util.regex.Matcher
import javax.swing.JFileChooser
import javax.swing.JFileChooser
import java.util.regex.Matcher
import java.util.regex.Matcher
import a.b.c.D

import javax.swing.JFileChooser
import javax.swing.JFileChooser
import java.util.regex.Matcher
import f.g.h.I

class Wesh {
    Matcher inputZ
}

class Gros {
    JFileChooser inputX
}
`,
            sourceAfter: `
import java.util.regex.Matcher
import javax.swing.JFileChooser
import a.b.c.D

import f.g.h.I

class Wesh {
    Matcher inputZ
}

class Gros {
    JFileChooser inputX
}
`
        }
    ]
};

module.exports = { rule };
