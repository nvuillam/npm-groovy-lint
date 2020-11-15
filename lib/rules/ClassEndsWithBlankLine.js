// Unused import

const { getVariable } = require("../utils");

const rule = {
    scope: "file",
    unitary: true,
    fix: {
        label: "Add blank line before end of the class",
        type: "function",
        func: (allLines, variables) => {
            const lineNumber = getVariable(variables, "lineNb", { mandatory: true });
            if (allLines[lineNumber].includes("}")) {
                allLines.splice(lineNumber, 0, "");
            }
            return allLines;
        }
    },

    tests: [
        {
            sourceBefore: `
class NullResultsProcessor implements ResultsProcessor {

    @Override
    void processResults(Results results) {
        println 'wesh'
    }
}
`,
            sourceAfter: `
class NullResultsProcessor implements ResultsProcessor {

    @Override
    void processResults(Results results) {
        println 'wesh'
    }

}
`
        }
    ]
};

module.exports = { rule };
