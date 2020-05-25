// Unused import

const { getVariable } = require("../utils");

const rule = {
    scope: "file",
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
        // do nothing
    }
}
`,
            sourceAfter: `
class NullResultsProcessor implements ResultsProcessor {

    @Override
    void processResults(Results results) {
        // do nothing
    }

}
`
        }
    ]
};

module.exports = { rule };
