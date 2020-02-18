// List fixable CodeNarc rules
"use strict";

const npmGroovyLintRules = {

    SpaceAroundOperator: {
        fixable: true,
        variables: [
            {
                name: "OPERATOR",
                regex: /The operator "(.*)" within class (.*) is not preceded by a space or whitespace/
            }
        ],
        replacements: [
            {
                type: "replaceRegex",
                before: "[^ ]{{OPERATOR}}[^ ]",
                after: " {{OPERATOR}} "
            },
            {
                type: "replaceRegex",
                before: "[^ ]{{OPERATOR}}",
                after: " {{OPERATOR}}"
            },
            {
                type: "replaceRegex",
                before: "{{OPERATOR}}[^ ]",
                after: "{{OPERATOR}} "
            }
        ]
    },

    UnnecessaryGString: {
        fixable: true,
        variables: [
            {
                name: "STRING",
                regex: /The String '(.*)' can be wrapped in single quotes instead of double quotes/
            }
        ],
        replacements: [
            {
                type: "replaceString",
                before: "{{DOUBLE_QUOTE}}{{STRING}}{{DOUBLE_QUOTE}}",
                after: "{{SINGLE_QUOTE}}{{STRING}}{{SINGLE_QUOTE}}"
            }
        ]
    }
};

const npmGroovyLintGlobalReplacements = [
    { name: "DOUBLE_QUOTE", value: '"' },
    { name: "SINGLE_QUOTE", value: "'" }
];

module.exports = { npmGroovyLintRules, npmGroovyLintGlobalReplacements };
