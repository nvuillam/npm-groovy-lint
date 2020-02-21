/**
 * @fileoverview Options configuration for optionator.
 * @author Nicolas Vuillamy
 */

"use strict";

//------------------------------------------------------------------------------
// Requirements
//------------------------------------------------------------------------------

const optionator = require("optionator");

//------------------------------------------------------------------------------
// Initialization and Public Interface
//------------------------------------------------------------------------------

// exports "parse(args)", "generateHelp()", and "generateHelpForOption(optionName)"
module.exports = optionator({
    prepend: "npm-groovy-lint [options]",
    defaults: {
        concatRepeatedArrays: true,
        mergeRepeatedObjects: true
    },
    options: [
        {
            heading: "Basic configuration"
        },
        {
            option: "path",
            alias: "p",
            type: "path::String",
            default: ".",
            description: "Directory containing the files to lint (default: current directory)",
            example: "./path/to/my/groovy/files"
        },
        {
            option: "files",
            alias: "f",
            type: "String",
            description: "Comma-separated list of Ant-style file patterns specifying files that must be included",
            example: ["**/Jenkinsfile", "*/*.groovy"]
        },
        {
            option: "rulesets",
            alias: "r",
            type: "String",
            description:
                "RuleSet file(s) to use for linting. If it is a directory, all rulesets will be used. RuleSet file definition: http://codenarc.sourceforge.net/codenarc-creating-ruleset.html. If not specified, npm-groovy-script default one will be used",
            example: ["./config/codenarc/RuleSet-Custom.groovy", "./path/to/my/ruleset/files"]
        },
        {
            option: "output",
            alias: "o",
            type: "String",
            default: "txt",
            description: "Output format (txt,json,html,xml), or path to a file with one of these extensions",
            example: ["txt", "json", "./logs/myLintResults.txt", "./logs/myLintResults.json", "./logs/myLintResults.html", "./logs/myLintResults.xml"]
        },
        {
            option: "verbose",
            alias: "v",
            type: "Boolean",
            description: "More outputs in console, including performed fixes"
        },
        {
            heading: "Fixing problems"
        },
        {
            option: "fix",
            type: "Boolean",
            description: "Automatically fix problems when possible"
        },
        {
            heading: "Ignoring files"
        },
        {
            option: "ignore-pattern",
            alias: "i",
            type: "String",
            description: "Comma-separated list of Ant-style file patterns specifying files that must be ignored. Default: none",
            example: ["**/test/*"]
        },
        {
            heading: "Other"
        },
        {
            option: "failonerror",
            type: "Boolean",
            description: "Fails if at least one error is found"
        },
        {
            option: "failonwarning",
            type: "Boolean",
            description: "Fails if at least one warning is found"
        },
        {
            option: "failoninfo",
            type: "Boolean",
            description: "Fails if at least one error is found"
        },
        {
            option: "codenarcargs",
            type: "Boolean",
            example:
                'npm-groovy-lint --codenarcargs -basedir="jdeploy-bundle/lib/example" -rulesetfiles="file:jdeploy-bundle/lib/example/RuleSet-Groovy.groovy" -maxPriority1Violations=0 -report="xml:ReportTestCodenarc.xml',
            description:
                "Use core CodeNarc arguments (all npm-groovy-lint arguments will be ignored). Doc: http://codenarc.sourceforge.net/codenarc-command-line.html"
        },
        {
            option: "help",
            alias: "h",
            type: "Boolean",
            description: "Show help (npm-groovy-lint -help OPTIONNAME to see option detail)"
        }
    ]
});
