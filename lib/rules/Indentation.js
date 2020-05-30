// Indentation
// Warning CodeNarc does not like tabs, better replace them by spaces ...

const { getVariable } = require("../utils");

const rule = {
    triggers: ["IndentationClosingBraces", "IndentationComments"],

    variables: [
        {
            name: "EXPECTED",
            regex: /The (.*) is at the incorrect indent level: Expected column (.*) but was (.*)/,
            regexPos: 2,
            type: "number"
        },
        {
            name: "FOUND",
            regex: /The (.*) is at the incorrect indent level: Expected column (.*) but was (.*)/,
            regexPos: 3,
            type: "number"
        }
    ],
    range: {
        type: "function",
        func: (errLine, errItem, evaluatedVars) => {
            return {
                start: { line: errItem.line, character: 0 },
                end: { line: errItem.line, character: getVariable(evaluatedVars, "FOUND") - 1 }
            };
        }
    },
    fix: {
        label: "Correct Indentation",
        type: "function",
        func: (line, evaluatedVars) => {
            const expectedCol = parseInt(getVariable(evaluatedVars, "EXPECTED", { mandatory: true, line: line }), 10);
            //                const foundIndent = parseInt(getVariable(evaluatedVars, "FOUND", { mandatory: true, line: line }));
            /*     if (line.trim() === "}") {
                     // Manage Wrong info from codeNarc :/ {
                     line = " ".repeat(expectedIndent + (indentLength * 2)) + line.trimStart();
                 } else { */
            const startSpaces = expectedCol === 0 ? 0 : expectedCol - 1;
            line = " ".repeat(startSpaces) + line.trimStart();
            return line;
        }
    },
    tests: [
        {
            sourceBefore: `
if (a == 2){
x = 1
}`,
            sourceAfter: `
if (a == 2){
    x = 1
}`
        },
        {
            sourceBefore: `
docker.withRegistry("https://"+ envVars.GetDockerRegistry(), envVars.GetDockerRegistryCredsId()) {
              docker.image(envVars.GetFullImageName()).inside("--entrypoint=''") {
  withCredentials(credentials) {
            if (deploy == 'yes'){
                // Send start build notification
                if( it.config.containsKey("notifChannelCredsId")) {
                    p.k8sStage("\${it.config['name']} - Send notification",it, {
                        withCredentials([string(credentialsId: it.config['notifChannelCredsId'], variable: 'TEAMS_WEBHOOK')]) {
                                 office365ConnectorSend message : "\${env.JOB_BASE_NAME}", status :"Started", webhookUrl: "\${env.TEAMS_WEBHOOK}"
                        }
                                             })
                }
                            }
        }
             }
}
`,
            sourceAfter: `
docker.withRegistry("https://"+ envVars.GetDockerRegistry(), envVars.GetDockerRegistryCredsId()) {
    docker.image(envVars.GetFullImageName()).inside("--entrypoint=''") {
        withCredentials(credentials) {
            if (deploy == 'yes'){
                // Send start build notification
                if( it.config.containsKey("notifChannelCredsId")) {
                    p.k8sStage("\${it.config['name']} - Send notification",it, {
                        withCredentials([string(credentialsId: it.config['notifChannelCredsId'], variable: 'TEAMS_WEBHOOK')]) {
                            office365ConnectorSend message : "\${env.JOB_BASE_NAME}", status :"Started", webhookUrl: "\${env.TEAMS_WEBHOOK}"
                        }
                    })
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
