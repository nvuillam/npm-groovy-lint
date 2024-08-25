// Space after opening brace

import { getStringRange } from "../utils.js";

const rule = {
    range: {
        type: "function",
        func: (errLine, errItem) => {
            return getStringRange(errLine, "{", errItem);
        },
    },
    fix: {
        label: "Add space after opening brace",
        type: "function",
        func: (line) => {
            const regexMatch = line.match(new RegExp(/{[^ ]/, "g"));
            if (regexMatch && regexMatch[0]) {
                line = line.replace(regexMatch[0], "{ " + regexMatch[0][1]);
            }
            return line;
        },
    },
    tests: [
        {
            sourceBefore: `
class MyClass {
    def myMethod() {
        def closure = {}
    }
}
`,
            sourceAfter: `
class MyClass {
    def myMethod() {
        def closure = { }
    }
}
`,
        },
        {
            sourceBefore: `
class MyClass {int count }
class MyOtherClass extends AbstractClass {int count }
        `,
            sourceAfter: `
class MyClass { int count }
class MyOtherClass extends AbstractClass { int count }
        `,
        },
    ],
};

export { rule };
