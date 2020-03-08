
// Build Json for VsCode package.json Contribution section
"use strict";

// Imports
const fse = require('fs-extra');
const ruleSetAll = fse.readFileSync('lib/example/RuleSet-All.groovy', 'utf8');

const allLines = ruleSetAll.replace(/\r?\n/g, "\r\n").split("\r\n");

function buildVsCodeRules(allLines, ruleSetTypeName) {
    const configurationProperties = {};
    let currentCategory = null;

    for (const line of allLines) {
        // Got a new category
        if (line.includes('.xml')) {
            //line ex : "// rulesets/basic.xml"
            const splits = line.split('/');
            currentCategory = splits[splits.length - 1].replace('.xml', '').trim();
            continue;
        }
        // Check if the line is a rule ( contains only alphanumeric characters)
        if (currentCategory && line.trim() !== '' && line.trim().match("^[a-zA-Z0-9]*$")) {
            const ruleName = line.trim();
            const propName = `groovyLint.ruleset.${ruleSetTypeName}.custom.rules.${currentCategory}.${ruleName}`;
            let description = ruleName.replace(/([A-Z])/g, ' $1').trim();
            description = description.charAt(0).toUpperCase() + description.slice(1).toLowerCase()
            const property = {
                "scope": "resource",
                "description": description, // Add space before every capital character
                "type": "boolean",
                "default": true
            }
            configurationProperties[propName] = property;
        }
    }
    return configurationProperties;
}

const groovyVsCodeRules = JSON.stringify(buildVsCodeRules(allLines, 'groovy'), null, 4);
const jenkinsfileVsCodeRules = JSON.stringify(buildVsCodeRules(allLines, 'jenkinsfile'), null, 4);

fse.writeFileSync('vscode-rules-Groovy.json', groovyVsCodeRules);
fse.writeFileSync('vscode-rules-Jenkinsfile.json', jenkinsfileVsCodeRules);

console.log(groovyVsCodeRules);
console.log(jenkinsfileVsCodeRules);