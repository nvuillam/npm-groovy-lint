// Unused import

const { getVariable, getVariableRange } = require("../utils");

const rule = {
    scope: "file",
    unitary: true,
    variables: [
        {
            name: "CLASSNAME",
            regex: /The \[(.*)\] import is never referenced/,
            regexPos: 1
        }
    ],
    range: {
        type: "function",
        func: (errLine, errItem, evaluatedVars) => {
            return getVariableRange(errLine, evaluatedVars, "CLASSNAME", errItem);
        }
    },
    fix: {
        label: "Remove unused import",
        type: "function",
        func: (allLines, variables) => {
            const lineNumber = getVariable(variables, "lineNb", { mandatory: true });
            const className = getVariable(variables, "CLASSNAME", { mandatory: true });
            if (allLines[lineNumber].includes(className)) {
                allLines.splice(lineNumber, 1);
            } else {
                const itemIndex = allLines.findIndex(line => line.includes(className));
                throw new Error(`FIX ERROR: UnusedImport was expecting ${className} at position ${lineNumber} but it is at position ${itemIndex} `);
            }
            return allLines;
        }
    },

    tests: [
        {
            sourceBefore: `
import java.awt.notkept.Component
import java.text.notkept.SimpleDateFormat
import java.util.regex.Matcher
import javax.swing.notkept.JOptionPane
import javax.swing.notkept.filechooser.FileFilter
import javax.swing.JFileChooser
import org.apache.commons.lang3.notkept.SystemUtils

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
