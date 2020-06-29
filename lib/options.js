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
            option: "path",
            alias: "p",
            type: "path::String",
            default: ".",
            description: "Directory containing the files to lint (default: current directory)",
            example: ["./path/to/my/groovy/files"]
        },
        {
            option: "files",
            alias: "f",
            type: "String",
            description: "Comma-separated list of Ant-style file patterns specifying files that must be included",
            example: ["**/Jenkinsfile", "**/*.groovy", "**/*.gradle"]
        },
        {
            option: "source",
            alias: "s",
            type: "String",
            description: "Source text to lint (if no path/files arguments)",
            example: ["import groovyx.net.http.HTTPBuilder\n\nimport class Toto { \n }"]
        },
        {
            option: "sourcefilepath",
            type: "String",
            dependsOn: ["source"],
            description: "Full path of the file whose content is sent in source argument ",
            example: ["C:/some/folder/myScript.groovy", "/var/some/folder/myScript.groovy"]
        },
        {
            option: "parse",
            type: "Boolean",
            dependsOn: ["and", "source", "sourcefilepath"],
            description: "Try to compile the source code and return parse errors (works only with source argument)"
        },
        {
            option: "config",
            alias: "c",
            type: "String",
            default: process.cwd(),
            description:
                "Custom path to directory containing GroovyLint config file.\n Default: Found groovylintrc.js/json/yml/package.json config file, or default npm-groovy-lint config if not defined. \nNote: command-line arguments have priority on config file properties",
            example: ["./config", "./config/whatever"]
        },
        {
            option: "format",
            type: "Boolean",
            description: "Format source code"
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
            description: "Option for --fix argument: List of rule identifiers to fix (if not specified, all available fixes will be applied)",
            example: ["SpaceBeforeClosingBrace,SpaceAfterClosingBrace,UnusedImport"]
        },
        {
            option: "ignorepattern",
            alias: "i",
            type: "String",
            description: "Comma-separated list of Ant-style file patterns specifying files that must be ignored. Default: none",
            example: ["**/test/*"]
        },
        {
            option: "rulesets",
            alias: "r",
            type: "String",
            description:
                "RuleSet file(s) to use for linting. If it is a directory, all rulesets will be used. RuleSet file definition: http://codenarc.github.io/CodeNarc/codenarc-creating-ruleset.html. If not specified, npm-groovy-script default one will be used. Can also be a list of rule identifiers with parameters",
            example: [
                "./config/codenarc/RuleSet-Custom.groovy",
                "./path/to/my/ruleset/files",
                'Indentation{"spacesPerIndentLevel":2,"severity":"warning"},UnnecessarySemicolon,UnnecessaryGString,ConsecutiveBlankLines{"severity":"warning"},NoTabCharacter'
            ]
        },
        {
            option: "rulesetsoverridetype",
            type: "String",
            dependsOn: ["rulesets"],
            enum: ["replaceConfig", "appendConfig"],
            default: "replaceConfig",
            description:
                "If list of rules sent in rulesets option, defines if they replace rules defined in .groovylintrc.json, or if they are appended",
            example: ["replaceConfig", "appendConfig"]
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
            description:
                "Use core CodeNarc arguments (all npm-groovy-lint arguments will be ignored). Doc: http://codenarc.github.io/CodeNarc/codenarc-command-line.html",
            example: [
                'npm-groovy-lint --codenarcargs -basedir="lib/example" -rulesetfiles="file:lib/example/RuleSet-Groovy.groovy" -maxPriority1Violations=0 -report="xml:ReportTestCodenarc.xml'
            ]
        },
        {
            option: "noserver",
            type: "Boolean",
            description:
                "For better performances, npm-groovy-lint runs a local server to eep CodeNarc alive instead of loading java/groovy at each call. If you don't want that, send this argument"
        },
        {
            option: "serverhost",
            type: "String",
            default: "http://" + require("ip").address(),
            description: "If use of CodeNarc server, host where is the CodeNarc server (default: localhost)"
        },
        {
            option: "serverport",
            type: "String",
            default: "7484",
            description: "If use of CodeNarc server, port of the CodeNarc server (default: 7484)",
            example: ["2702"]
        },
        {
            option: "killserver",
            type: "Boolean",
            description: "Terminate the CodeNarcServer if running"
        },
        {
            option: "nolintafter",
            type: "Boolean",
            description: "Do not lint again after format and fix options (useful for client calling Npm Groovy Lint)"
        },
        {
            option: "returnrules",
            type: "Boolean",
            description: "Return rule descriptions and url if this argument is set"
        },
        {
            option: "insight",
            type: "Boolean",
            description:
                "npm-groovy-lint collects anonymous usage statistics using package https://www.npmjs.com/package/insight. If you do not want to share them, use --no-insight option"
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
        ["failonerror", "failonwarning", "failoninfo"],
        [
            "codenarcargs",
            [
                "failonerror",
                "failonwarning",
                "failoninfo",
                "path",
                "files",
                "source",
                "format",
                "fix",
                "fixrules",
                "config",
                "returnrules",
                "killserver",
                "nolintafter",
                "noserver",
                "serverhost",
                "serverport"
            ]
        ],
        ["noserver", ["serverhost", "serverport", "killserver"]],
        ["fix", "format"],
        [
            ["fix", "format"],
            ["failonerror", "failonwarning", "failoninfo"]
        ]
    ]
});
