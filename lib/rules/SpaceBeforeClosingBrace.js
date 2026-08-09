// Space before opening brace
import { getStringRange } from "../utils.js";

const rule = {
    range: {
        type: "function",
        func: (errLine, errItem) => {
            return getStringRange(errLine, "}", errItem);
        },
    },
    fix: {
        label: "Add space before closing brace",
        type: "function",
        func: (line) => {
            const regexMatch = line.match(new RegExp(/[^ ]}/, "g"));
            if (regexMatch && regexMatch[0]) {
                line = line.replace(regexMatch[0], regexMatch[0][0] + " }");
            }
            return line;
        },
    },
    tests: [
        {
            sourceBefore: `
process2.inputStream.eachLine { Utils.printlnLog it}
`,
            sourceAfter: `
process2.inputStream.eachLine { Utils.printlnLog it }
`,
        },
    ],
};

export { rule };
