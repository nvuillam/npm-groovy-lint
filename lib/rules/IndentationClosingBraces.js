import { containsExceptInsideString } from "../utils.js";

// Indentation closing braces
const rule = {
    scope: "file",
    isCodeNarcRule: false,
    fix: {
        label: "Fix indentation closing braces",
        type: "function",
        func: (allLines) => {
            const newFileLines = [];
            for (let i = 0; i < allLines.length; i++) {
                let line = allLines[i] + "";
                // Detect closing brace line
                if (["}", "})", "});"].includes(line.trim())) {
                    // Find indentation of matching brace (CodeNarc Indentation rule does not always work well :/ )
                    let j = 1;
                    let matchingLineIndent = null;
                    let level = 1;
                    while ((allLines[i - j] || allLines[i - j] === "") && matchingLineIndent == null) {
                        const prevLine = allLines[i - j];
                        if (containsExceptInsideString(prevLine, "}")) {
                            //if (prevLine.includes("}") && !prevLine.includes("${")) {
                            level++;
                        }
                        //if (prevLine.includes("{") && !prevLine.includes("${")) {
                        if (containsExceptInsideString(prevLine, "{")) {
                            level--;
                            if (level === 0) {
                                matchingLineIndent = prevLine.search(/\S/);
                                break;
                            }
                        }
                        j++;
                    }
                    // Set new indentation it on this comment line
                    if (matchingLineIndent || matchingLineIndent === 0) {
                        line = (" ".repeat(matchingLineIndent) + line.trimStart()).replace(/\t/g, "");
                    }
                }
                newFileLines.push(line);
            }
            return newFileLines;
        },
    },
    tests: [
        {
            sourceBefore: `
try { 
    whatever () 
} catch { 
    whateverelse()
         }
`,
            sourceAfter: `
try { 
    whatever () 
} catch { 
    whateverelse()
}
`,
        },
        {
            sourceBefore: `
docker.withRegistry("https://"+ envVars.GetDockerRegistry(), envVars.GetDockerRegistryCredsId()) {
    docker.image(envVars.GetFullImageName()).inside("--entrypoint=''") {
        withCredentials(credentials) {          
            if (deploy == 'yes'){
                // Send start build notification
                if( it.config.containsKey("notifChannelCredsId")){
                    p.k8sStage("\${it.config['name']} - Send notification",it, {
                        withCredentials([string(credentialsId: it.config['notifChannelCredsId'], variable: 'TEAMS_WEBHOOK')])
                        {
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
    `,
        },
    ],
};

export { rule };
