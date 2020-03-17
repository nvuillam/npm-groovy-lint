
// Build Json for VsCode package.json Contribution section
"use strict";

// Imports
const fse = require('fs-extra');
const ruleSetAll = fse.readFileSync('lib/example/RuleSet-All.groovy', 'utf8');

const allLines = ruleSetAll.replace(/\r?\n/g, "\r\n").split("\r\n");

function buildAllRules(allLines) {
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
            const propName = `${currentCategory}.${ruleName}`;
            let description = ruleName.replace(/([A-Z])/g, ' $1').trim();
            description = description.charAt(0).toUpperCase() + description.slice(1).toLowerCase()
            const property = {};
            configurationProperties[propName] = property;
        }
    }
    return configurationProperties;
}

const allRulesConfig = buildAllRules(allLines);

const fullConfigIndented = JSON.stringify({ "rules": allRulesConfig }, null, 4);

fse.writeFileSync('.groovylintrc-all.json', fullConfigIndented);

console.log('Generated .groovylintrc-all.json fullConfig');
