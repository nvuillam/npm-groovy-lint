// Blank line before package

const { getVariable } = require("../utils");

const rule = {
    scope: "file",
    unitary: true,
    fix: {
        label: "Remove blank line before package",
        type: "function",
        func: (allLines, variables) => {
            const lineNumber = getVariable(variables, "lineNb", { mandatory: true });
            if (allLines[lineNumber].trim() === "") {
                allLines.splice(lineNumber, 1);
            } else if (allLines[lineNumber + 1].trim() === "") {
                allLines.splice(lineNumber + 1, 1);
            }
            return allLines;
        }
    },

    tests: [
        {
            sourceBefore: `#!/usr/bin/env groovy

package org.pdxc.devops

class BuildEnv implements Serializable {
    private String image
    private String tag 
    private String dockerRegistry
    private String dockerRegistryCredsId
    private Map envVars
}
`,
            sourceAfter: `#!/usr/bin/env groovy
package org.pdxc.devops

class BuildEnv implements Serializable {
    private String image
    private String tag 
    private String dockerRegistry
    private String dockerRegistryCredsId
    private Map envVars
}
`
        }
    ],
    rangeTests: [
        {
            source: `#!/usr/bin/env groovy

package org.pdxc.devops

class BuildEnv implements Serializable {
    private String image
    private String tag 
    private String dockerRegistry
    private String dockerRegistryCredsId
    private Map envVars
}
`,
            expectedRange: {
                start: {
                    line: 1,
                    character: 0
                },
                end: {
                    line: 1,
                    character: 21
                }
            }
        }
    ]
};

module.exports = { rule };
