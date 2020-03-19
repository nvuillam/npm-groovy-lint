// Unused import

const { getVariable } = require("../utils");

const rule = {
    scope: "file",
    variables: [
        {
            name: "CLASSNAME",
            regex: /The \[(.*)\] import is never referenced/,
            regexPos: 1
        }
    ],
    unitary: true,
    fix: {
        label: "Remove unused import",
        type: "function",
        func: (allLines, variables) => {
            const lineNumber = getVariable(variables, "lineNb", { mandatory: true });
            const className = getVariable(variables, "CLASSNAME", { mandatory: true });
            if (allLines[lineNumber].includes(className)) {
                allLines.splice(lineNumber, 1);
            }
            return allLines;
        }
    },

    tests: [
        {
            sourceBefore: `
import java.awt.Component
import java.text.SimpleDateFormat
import java.util.regex.Matcher
import javax.swing.JOptionPane
import javax.swing.filechooser.FileFilter
import javax.swing.JFileChooser
import org.apache.commons.lang3.SystemUtils

class SaMere {

    Matcher inputZ

}

class SaMere2 {

    JFileChooser inputX

}
`,
            sourceAfter: `
import java.util.regex.Matcher
import javax.swing.JFileChooser

class SaMere {

    Matcher inputZ

}
class SaMere2 {

    JFileChooser inputX

}
`
        }
    ]
};

module.exports = { rule };
