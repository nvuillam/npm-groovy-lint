// Unnecessary semi colon at the end of a line

import { getLastStringRange } from "../utils.js";

const rule = {
    range: {
        type: "function",
        func: (errLine, errItem) => {
            return getLastStringRange(errLine, ";", errItem);
        },
    },
    fix: {
        label: "Remove unnecessary semicolon",
        type: "function",
        func: (line) => {
            if ((line.match(/;/g) || []).length === 1) {
                line = line.split(";").join("").trimRight();
            }
            return line;
        },
    },
    tests: [
        {
            sourceBefore: `
String str = 'lelamanul';
`,
            sourceAfter: `
String str = 'lelamanul'
`,
        },
        {
            sourceBefore: `
package my.company.server;
import java.lang.String ;    
println("test");             
`,
            sourceAfter: `
package my.company.server
import java.lang.String
println("test")
`,
        },
    ],
};

export { rule };
