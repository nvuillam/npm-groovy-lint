// Closing brace not alone
const rule = {
    scope: "file",
    isCodeNarcRule: false,
    range: {
        type: "function",
        func: (errLine, errItem) => {
            const closingBracePos = errLine.lastIndexOf("}");
            return {
                start: { line: errItem.line, character: closingBracePos },
                end: { line: errItem.line, character: closingBracePos + 1 }
            };
        }
    },
    fix: {
        type: "function",
        func: allLines => {
            const newFileLines = [];
            let prevLine = "";
            for (const line of allLines) {
                const newLine = line.replace("###NEWLINECLOSINGBRACE###", "");
                newFileLines.push(newLine);
                if (newLine !== line) {
                    const prevLineIndent = prevLine.search(/\S/);
                    const closingBraceLine = prevLineIndent > -1 ? " ".repeat(prevLineIndent) + "}" : "}";
                    newFileLines.push(closingBraceLine);
                    prevLine = closingBraceLine;
                } else {
                    prevLine = newLine;
                }
            }
            return newFileLines;
        }
    },
    tests: [
        {
            sourceBefore: `
if (a == 1) {
    whatever()###NEWLINECLOSINGBRACE###
`,
            sourceAfter: `
if (a == 1) {
    whatever()
}
`
        }
    ]
};

module.exports = { rule };
