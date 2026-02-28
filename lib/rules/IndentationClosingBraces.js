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
                        // Remove content inside quotes (handling escaped quotes) to avoid counting braces inside strings
                        const lineWithoutQuotedStuff = prevLine.replace(/(["'])((?:\\.|(?!\1).)*?)\1/g, "");
                        const closingBraces = (lineWithoutQuotedStuff.match(/}/g) || []).length;
                        const openingBraces = (lineWithoutQuotedStuff.match(/\{/g) || []).length;
                        level += closingBraces - openingBraces;
                        // Use <= 0 to handle lines with more opening than closing braces (e.g., nested inline closures)
                        if (level <= 0) {
                            matchingLineIndent = prevLine.search(/\S/);
                            break;
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
items.each { item ->
  if (item.type == 'container') {
    if (!resources.any { it?.name.contains('deprecated') }) {
      results[item.name] = [
        status: 'success',
        message: 'Container processed'
      ]
        }
      }
}
`,
            sourceAfter: `
items.each { item ->
  if (item.type == 'container') {
    if (!resources.any { it?.name.contains('deprecated') }) {
      results[item.name] = [
        status: 'success',
        message: 'Container processed'
      ]
    }
  }
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
