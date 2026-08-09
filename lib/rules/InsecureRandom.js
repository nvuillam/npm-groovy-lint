// Insecure use of Random
import { addImport, getVariable, getVariableRange } from "../utils.js";

const rule = {
    scope: "file",
    unitary: true,
    variables: [
        {
            name: "RANDOM_REFERENCE",
            regex: /Using (.*) is insecure. Use SecureRandom instead/,
        },
    ],
    range: {
        type: "function",
        func: (errLine, errItem, evaluatedVars) => {
            return getVariableRange(errLine, evaluatedVars, "RANDOM_REFERENCE", errItem);
        },
    },
    fix: {
        label: "Replace by SecureRandom use",
        type: "function",
        func: (allLines, variables) => {
            const lineNumber = getVariable(variables, "lineNb", { mandatory: true });
            let line = allLines[lineNumber];
            const randomRef = getVariable(variables, "RANDOM_REFERENCE", { mandatory: true, htmlToString: true, line: line });
            switch (randomRef) {
                case "Random":
                    line = line.replace("java.util.Random()", "SecureRandom()").replace(/(?<!Secure)Random\(\)/, "SecureRandom()");
                    break;
                case "Math.random()":
                    line = line
                        .replace("java.lang.Math.random()", "new SecureRandom().nextDouble()")
                        .replace("Math.random()", "new SecureRandom().nextDouble()");
                    break;
            }
            allLines[lineNumber] = line;
            allLines = addImport(allLines, "java.security.SecureRandom");
            return allLines;
        },
    },
    tests: [
        {
            sourceBefore: `def r1 = new Random()
def r2 = new java.util.Random()
def r3 = Math.random()
def r4 = java.lang.Math.random()
def r5 = "lelamanul"+Math.random()+"_yeah_"+java.lang.Math.random()
`,
            sourceAfter: `import java.security.SecureRandom

def r1 = new SecureRandom()
def r2 = new SecureRandom()
def r3 = new SecureRandom().nextDouble()
def r4 = new SecureRandom().nextDouble()
def r5 = "lelamanul"+new SecureRandom().nextDouble()+"_yeah_"+new SecureRandom().nextDouble()
`,
        },
        {
            sourceBefore: `
package le.lama.Nul

import a.b.c.D
import e.f.g.H

def r1 = new Random()
def r2 = new java.util.Random()
def r3 = Math.random()
def r4 = java.lang.Math.random()
def r5 = "lelamanul"+Math.random()+"_yeah_"+java.lang.Math.random()
`,
            sourceAfter: `
package le.lama.Nul

import a.b.c.D
import e.f.g.H
import java.security.SecureRandom

def r1 = new SecureRandom()
def r2 = new SecureRandom()
def r3 = new SecureRandom().nextDouble()
def r4 = new SecureRandom().nextDouble()
def r5 = "lelamanul"+new SecureRandom().nextDouble()+"_yeah_"+new SecureRandom().nextDouble()
`,
        },
        {
            sourceBefore: `
import a.b.c.D
import e.f.g.H

def r1 = new Random()
def r2 = new java.util.Random()
def r3 = Math.random()
def r4 = java.lang.Math.random()
def r5 = "lelamanul"+Math.random()+"_yeah_"+java.lang.Math.random()
`,
            sourceAfter: `
import a.b.c.D
import e.f.g.H
import java.security.SecureRandom

def r1 = new SecureRandom()
def r2 = new SecureRandom()
def r3 = new SecureRandom().nextDouble()
def r4 = new SecureRandom().nextDouble()
def r5 = "lelamanul"+new SecureRandom().nextDouble()+"_yeah_"+new SecureRandom().nextDouble()
`,
        },
        {
            sourceBefore: `def r1 = new Random()
def r2 = new java.util.Random()
def r3 = Math.random()
def r4 = java.lang.Math.random()
def r5 = "lelamanul"+Math.random()+"_yeah_"+java.lang.Math.random()
`,
            sourceAfter: `import java.security.SecureRandom

def r1 = new SecureRandom()
def r2 = new SecureRandom()
def r3 = new SecureRandom().nextDouble()
def r4 = new SecureRandom().nextDouble()
def r5 = "lelamanul"+new SecureRandom().nextDouble()+"_yeah_"+new SecureRandom().nextDouble()
`,
        },
        {
            sourceBefore: `/* blablabla */

def r1 = new Random()
def r2 = new java.util.Random()
def r3 = Math.random()
def r4 = java.lang.Math.random()
def r5 = "lelamanul"+Math.random()+"_yeah_"+java.lang.Math.random()
`,
            sourceAfter: `/* blablabla */
import java.security.SecureRandom

def r1 = new SecureRandom()
def r2 = new SecureRandom()
def r3 = new SecureRandom().nextDouble()
def r4 = new SecureRandom().nextDouble()
def r5 = "lelamanul"+new SecureRandom().nextDouble()+"_yeah_"+new SecureRandom().nextDouble()
`,
        },
        {
            sourceBefore: `/* blablabla */

package le.lama.nul

def r1 = new Random()
def r2 = new java.util.Random()
def r3 = Math.random()
def r4 = java.lang.Math.random()
def r5 = "lelamanul"+Math.random()+"_yeah_"+java.lang.Math.random()
`,
            sourceAfter: `/* blablabla */

package le.lama.nul

import java.security.SecureRandom

def r1 = new SecureRandom()
def r2 = new SecureRandom()
def r3 = new SecureRandom().nextDouble()
def r4 = new SecureRandom().nextDouble()
def r5 = "lelamanul"+new SecureRandom().nextDouble()+"_yeah_"+new SecureRandom().nextDouble()
`,
        },
    ],
};

export { rule };
