// No tab character

import { getIndentLength } from "../utils.js";

const rule = {
    scope: "file",
    fix: {
        label: "Replace tabs by spaces in all file",
        type: "function",
        func: (allLines) => {
            const newFileLines = [];
            const replaceChars = " ".repeat(getIndentLength());
            for (const line of allLines) {
                newFileLines.push(line.replace(/\t/g, replaceChars));
            }
            return newFileLines;
        },
    },
    tests: [
        {
            sourceBefore: `
try {
\twhatever (\t)
} catch(Exception){
\twhateverelse(\t)
}
`,
            sourceAfter: `
try {
    whatever (    )
} catch(Exception){
    whateverelse(    )
}
`,
        },
    ],
};

export { rule };
