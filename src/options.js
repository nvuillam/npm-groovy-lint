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
            option: "source",
            alias: "s",
            type: "String",
            description: "Source text to lint (if no path/files arguments)",
            example: ["import groovyx.net.http.HTTPBuilder\n\nimport class Toto { \n }"]
        },
        {
            option: "config",
            alias: "c",
            type: "String",
            default: process.cwd(),
            description:
                "Custom path to GroovyLint config file.\n Default: Found groovylintrc.js/json/yml/package.json config file, or default npm-groovy-lint config if not defined. \nNote: command-line arguments have priority on config file properties",
            example: ["./config/.groovylintrc-custom.js", "./config/.groovylintrc-custom.json"]
        },
        {
            option: "rulesets",
            alias: "r",
            type: "String",
            description:
                "RuleSet file(s) to use for linting. If it is a directory, all rulesets will be used. RuleSet file definition: http://codenarc.github.io/CodeNarc/codenarc-creating-ruleset.html. If not specified, npm-groovy-script default one will be used",
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
            option: "loglevel",
            alias: "l",
            type: "String",
            enum: ["error", "warning", "info"],
            default: "info",
            description: "Log level (error,warning,info)",
            example: ["warning", "error"]
        },
        {
            option: "verbose",
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
            option: "fixrules",
            alias: "x",
            type: "String",
            default: "all",
            dependsOn: ["fix"],
            description: "List of rule identifiers to fix (if not specified, all available fixes will be applied)"
        },
        {
            heading: "Ignoring files"
        },
        {
            option: "ignorepattern",
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
                "Use core CodeNarc arguments (all npm-groovy-lint arguments will be ignored). Doc: http://codenarc.github.io/CodeNarc/codenarc-command-line.html"
        },
        {
            option: "noserver",
            type: "Boolean",
            description:
                "For better perfs, npm-groovy-lint runs a local server to eep CodeNarc alive instead of loading java/groovy at each call. If you don't want that, send this argument"
        },
        {
            option: "serverhost",
            type: "String",
            default: "http://" + require("ip").address(), //Usually localhost, but not always on CIs (Circle, Jenkins ...)
            description: "If use of CodeNarc server, host where is the CodeNarc server (default: localhost)"
        },
        {
            option: "serverport",
            type: "String",
            default: "7484",
            description: "If use of CodeNarc server, port of the CodeNarc server (default: 7484)"
        },
        {
            option: "killserver",
            type: "Boolean",
            description: "Terminate the CodeNarcServer if running"
        },
        {
            option: "help",
            alias: "h",
            type: "Boolean",
            description: "Show help (npm-groovy-lint -help OPTIONNAME to see option detail)"
        },
        {
            option: "version",
            alias: "v",
            type: "Boolean",
            description: "Show version"
        }
    ],
    mutuallyExclusive: [
        ["files", "source", "codenarcargs", "help", "version"],
        [["path", "files"], "source"],
        ["failonerror", "failonwarning", "failoninfo"],
        ["codenarcargs", ["failonerror", "failonwarning", "failoninfo", "path", "files", "source", "fix", "fixrules"]],
        [["noserver"], ["serverhost", "serverport", "killserver"]]
    ]
});
