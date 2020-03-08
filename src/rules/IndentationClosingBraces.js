// Indentation closing braces
const rule = {
    scope: "file",
    isCodeNarcRule: false,
    fix: {
        label: "Fix indentation",
        type: "function",
        func: allLines => {
            const newFileLines = [];
            for (let i = 0; i < allLines.length; i++) {
                let line = allLines[i] + "";
                // Detect closing brace line
                if (line.trim() === "}") {
                    // Find indentation of matching brace (CodeNarc Indentation rule does not always work well :/ )
                    let j = 1;
                    let matchingLineIndent = null;
                    let level = 1;
                    while ((allLines[i - j] || allLines[i - j] === "") && matchingLineIndent == null) {
                        const prevLine = allLines[i - j];
                        if (prevLine.includes("}") && !prevLine.includes("${")) {
                            level++;
                        }
                        if (prevLine.includes("{") && !prevLine.includes("${")) {
                            level--;
                            if (level === 0) {
                                matchingLineIndent = prevLine.search(/\S/);
                            }
                        }
                        j++;
                    }
                    // Set new indentation it on this comment line
                    if (matchingLineIndent) {
                        line = (" ".repeat(matchingLineIndent) + line.trimStart()).replace(/\t/g, "");
                    }
                }
                newFileLines.push(line);
            }
            return newFileLines;
        }
    },
    tests: [
        {
            sourceBefore: `
try { 
    whatever () 
} catch { 
    whateverelse()
         }
`,
            sourceAfter: `
try { 
    whatever () 
} catch { 
    whateverelse()
}
`
        }
    ]
};

module.exports = { rule };
