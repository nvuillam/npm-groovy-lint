// Trailing Whitespaces

const rule = {
    range: {
        type: "function",
        func: (errLine, errItem) => {
            const diff = errLine.length - errLine.trimEnd().length;
            return {
                start: { line: errItem.line, character: errLine.length - diff },
                end: { line: errItem.line, character: errLine.length },
            };
        },
    },
    fix: {
        label: "Remove trailing whitespace",
        type: "function",
        func: (line) => {
            return line.trimEnd();
        },
    },
    tests: [
        {
            sourceBefore: `
    def str = "lelamanul"                
`,
            sourceAfter: `
    def str = "lelamanul"
`,
        },
    ],
};

export { rule };
