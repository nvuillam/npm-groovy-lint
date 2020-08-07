
// Build Json containing all CodeNarc rules
"use strict";

// Imports
const fse = require('fs-extra');
const { getNpmGroovyLintRules } = require("./lib/groovy-lint-rules.js");

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

fse.writeFileSync('./lib/.groovylintrc-all.json', fullConfigIndented);

console.log('Generated lib/.groovylintrc-all.json fullConfig');

const npmDefinedRules = getNpmGroovyLintRules();
const fixableRules = [];
for (const rule of Object.keys(npmDefinedRules)) {
    if (npmDefinedRules[rule].fix) {
        fixableRules.push('- ' + rule);
    }
}
fixableRules.sort();
const mdLog = fixableRules.join('\n');
console.log('Fixable rules :\n' + mdLog);