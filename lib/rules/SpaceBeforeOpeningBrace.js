// Space before opening brace
const { getStringRange } = require("../utils");

const rule = {
    range: {
        type: "function",
        func: (errLine, errItem) => {
            return getStringRange(errLine, "{", errItem);
        }
    },
    fix: {
        label: "Add space before opening brace",
        type: "function",
        func: line => {
            const regexMatch = line.match(new RegExp(/[^ |$]{/, "g"));
            if (regexMatch && regexMatch[0]) {
                line = line.replace(regexMatch[0], regexMatch[0][0] + " {");
            }
            return line;
        }
    },
    tests: [
        {
            sourceBefore: `
class MyClass{ }
class MyOtherClass extends AbstractClass{ }
`,
            sourceAfter: `
class MyClass { }
class MyOtherClass extends AbstractClass { }
`
        },
        {
            sourceBefore: `
pipeline {
    stages {
        stage('CleanWorkspace') {
            steps {
                cleanWs()
                dir("../\${JOB_NAME}@2"){
                    deleteDir()
                }
            }
        }
    }
}
`,
            sourceAfter: `
pipeline {
    stages {
        stage('CleanWorkspace') {
            steps {
                cleanWs()
                dir("../\${JOB_NAME}@2") {
                    deleteDir()
                }
            }
        }
    }
}
`
        }
    ]
};

module.exports = { rule };
