// Indentation comments

const rule = {
    scope: "file",
    isCodeNarcRule: false,
    fix: {
        label: "Fix indentation",
        type: "function",
        func: (allLines) => {
            const newFileLines = [];
            for (let i = 0; i < allLines.length; i++) {
                let line = allLines[i];
                // Detect comment line
                if (line.trimStart().startsWith("//")) {
                    // Find indentation of next line (which is not blank or a comment)
                    let j = 1;
                    let nextLineIndent = null;
                    while (allLines[i + j] && nextLineIndent == null) {
                        if (!/^\s*$/.test(allLines[i + j]) && !allLines[i + j].trimStart().startsWith("//")) {
                            nextLineIndent = allLines[i + j].search(/\S/); // find first non blank character
                        }
                        j++;
                    }
                    // Set new indentation it on this comment line
                    if (nextLineIndent || nextLineIndent === 0) {
                        line = " ".repeat(nextLineIndent) + line.trimStart();
                    }
                }
                newFileLines.push(line);
            }
            return newFileLines;
        },
    },
    tests: [
        {
            sourceBefore: `
// comments should be aligned with line after
    whateverelse()
`,
            sourceAfter: `
    // comments should be aligned with line after
    whateverelse()
`,
        },
    ],
};

export { rule };
