// Space around operators

const { getVariable, getVariableRange, addSpaceAroundChar } = require("../utils");

const rule = {
    variables: [
        {
            name: "OPERATOR",
            regex: /The operator "(.*)" within class (.*) is not (.*) by a space or whitespace/
        }
    ],
    range: {
        type: "function",
        func: (errLine, errItem, evaluatedVars) => {
            return getVariableRange(errLine, evaluatedVars, "OPERATOR", errItem);
        }
    },
    fixesSameErrorOnSameLine: true,
    fix: {
        label: "Add space around operator",
        type: "function",
        func: (line, evaluatedVars) => {
            let operator = getVariable(evaluatedVars, "OPERATOR", { mandatory: true, htmlToString: true, line: line });
            return addSpaceAroundChar(line, operator, [
                ["+ =", "+="],
                ["+ +", "++"],
                ["- =", "-="],
                ["- -", "--"]
            ]);
        }
    },
    tests: [
        {
            sourceBefore: `
class MyClass {
    def myMethod() {
        [1,2]as String
        { -> println 123 } as Runnable      // ok
        { -> println 456 } as
            Runnable
        { -> println 789
                } as Runnable
        (int)34.56                          // ignored
    }

    def myField = 'Toto'+'Titi'+'Tutu'
}
`,
            sourceAfter: `
class MyClass {
    def myMethod() {
        [1,2] as String
        { -> println 123 } as Runnable      // ok
        { -> println 456 } as
            Runnable
        { -> println 789
                } as Runnable
        (int)34.56                          // ignored
    }

    def myField = 'Toto' + 'Titi' + 'Tutu'
}
`
        },
        {
            sourceBefore: `
def grantCommand = 'sfdx force:auth:jwt:grant --clientid '+sslParams['clientId']+' --jwtkeyfile ./ssl/'+alias+'.key --username '+sslParams['username']+' --setalias '+alias
`,
            sourceAfter: `
def grantCommand = 'sfdx force:auth:jwt:grant --clientid ' + sslParams['clientId'] + ' --jwtkeyfile ./ssl/' + alias + '.key --username ' + sslParams['username'] + ' --setalias ' + alias
`
        },
        {
            sourceBefore: `
def tutu=8
tutu+= 10+2
`,
            sourceAfter: `
def tutu = 8
tutu += 10 + 2
`
        },
        {
            sourceBefore: `
image.inside {
    sshagent(credentials: ['ssh-creds']) {
        env.GIT_SSH_COMMAND='ssh -T -o StrictHostKeyChecking=no'

        stage('Validate Terraform') {
            sh 'terraform validate'
        }
    }
}
`,
            sourceAfter: `
image.inside {
    sshagent(credentials: ['ssh-creds']) {
        env.GIT_SSH_COMMAND = 'ssh -T -o StrictHostKeyChecking=no'

        stage('Validate Terraform') {
            sh 'terraform validate'
        }
    }
}
`
        },
        {
            sourceBefore: `
image.inside {
    sshagent(credentials: ['ssh-creds']) {
        env.GIT_SSH_COMMAND="ssh -T -o StrictHostKeyChecking=no"

        stage('Validate Terraform') {
            sh 'terraform validate'
        }
    }
}
`,
            sourceAfter: `
image.inside {
    sshagent(credentials: ['ssh-creds']) {
        env.GIT_SSH_COMMAND = "ssh -T -o StrictHostKeyChecking=no"

        stage('Validate Terraform') {
            sh 'terraform validate'
        }
    }
}
`
        }
    ]
};

module.exports = { rule };
