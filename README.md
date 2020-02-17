# NPM GROOVY LINT

[![Version](https://img.shields.io/npm/v/npm-groovy-lint.svg)](https://npmjs.org/package/npm-groovy-lint)
[![Downloads/week](https://img.shields.io/npm/dw/npm-groovy-lint.svg)](https://npmjs.org/package/npm-groovy-lint) 
[![CircleCI](https://circleci.com/gh/nvuillam/npm-groovy-lint/tree/master.svg?style=shield)](https://circleci.com/gh/nvuillam/npm-groovy-lint/tree/master)
[![codecov](https://codecov.io/gh/nvuillam/npm-groovy-lint/branch/master/graph/badge.svg)](https://codecov.io/gh/nvuillam/npm-groovy-lint)
[![GitHub contributors](https://img.shields.io/github/contributors/nvuillam/npm-groovy-lint.svg)](https://gitHub.com/nvuillam/npm-groovy-lint/graphs/contributors/)
[![GitHub stars](https://img.shields.io/github/stars/nvuillam/npm-groovy-lint?style=social&label=Star&maxAge=2592000)](https://GitHub.com/nvuillam/npm-groovy-lint/stargazers/)
[![License](https://img.shields.io/npm/l/npm-groovy-lint.svg)](https://github.com/nvuillam/npm-groovy-lint/blob/master/package.json) 
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](http://makeapullrequest.com)
[![Say Thanks!](https://img.shields.io/badge/Say%20Thanks-!-1EAEDB.svg)](https://saythanks.io/to/nicolas.vuillamy@gmail.com)

Wrapper for excellent groovy linter [CodeNarc](http://codenarc.sourceforge.net/), using the great [jdeploy](https://github.com/shannah/jdeploy) and [Groovy](https://groovy-lang.org/)!

**npm-groovy-lint** allows you to run CodeNarc via command line without any installation issue

Easy to integrate in a CD/CI process (Jenkins Pipeline,CircleCI...) to lint your groovy or Jenkinsfile :)

# INSTALLATION

```
    $ npm install -g npm-groovy-lint
```

For advanced usage,  you may need to define [RuleSet file(s)](http://codenarc.sourceforge.net/codenarc-creating-rule.html)

You can use as starters :

- [All rules](https://github.com/nvuillam/npm-groovy-lint/blob/master/dist/test/RuleSet-All.groovy)
- [Base rules](https://github.com/nvuillam/npm-groovy-lint/blob/master/dist/test/RuleSet-Base.groovy)

# USAGE

```
    $ npm-groovy-lint OPTIONS
```

## npm-groovy-lint OPTIONS

| Parameter    | Description                                                                                                  | Example                             |
|--------------|--------------------------------------------------------------------------------------------------------------|-------------------------------------|
| --ngl-output=format | npm-groovy-lint provided output (reformatted from CodeNarc output).<br/> Available formats: <br/>- text (default)<br/> - json | --ngl-output=json <br/> --ngl-output=text |
|              |                                                                                                              |                                     |

## CodeNarc OPTIONS

| Parameter                      | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Example                                                                                                                        |
|--------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------|
| -basedir=DIR                   | The base (root) directory for the source code to be analyzed. Defaults to the current directory (".").                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | -basedir=src/main/groovy                                                                                                       |
| -includes=PATTERNS             | The comma-separated list of Ant-style file patterns specifying files that must be included. Defaults to "**/*.groovy".                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | -includes=**/*.gr                                                                                                              |
| -excludes=PATTERNS             | The comma-separated list of Ant-style file patterns specifying files that must be excluded. No files are excluded when omitted.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | -excludes=**/templates/**, **/*Test.*                                                                                          |
| -rulesetfiles=FILENAMES        | The path to the Groovy or XML RuleSet definition files. This can be a single file path, or multiple paths separated by commas. By default, the paths specified are relative to the classpath. But these paths may be optionally prefixed by any of the valid java.net.URL prefixes, such as "file:" (to load from a relative or absolute path on the filesystem), or "http:". If it is a URL, its path may be optionally URL-encoded. That can be useful if the path contains any problematic characters, such as comma (',') or hash ('#'). For instance: "file:src/test/resources/RuleSet-,#.txt" can be encoded as: "file:src%2Ftest%2Fresources%2FRuleSet-%2C%23.txt" See URLEncoder#encode(java.lang.String, java.lang.String). Defaults to "rulesets/basic.xml". | -rulesetfiles=rulesets/imports.xml, rulesets/naming.xml                                                                        |
| -report=REPORT-TYPE[:FILENAME] | The definition of the report to produce. The option value is of the form TYPE[:FILENAME], where TYPE is one of the predefined type names: "html", "xml", "text", "console" or else the fully-qualified class name of a class (accessible on the classpath) that implements the org.codenarc.report.ReportWriter interface. And FILENAME is the filename (with optional path) of the output report filename. If the report filename is omitted, the default filename for the report type is used ("CodeNarcReport.html" for "html" and "CodeNarcXmlReport.xml" for "xml"). If no report option is specified, default to a single "html" report with the default filename.                                                                                               | -report=html -report=html:MyProject.html -report=xml -report=xml:MyXmlReport.xml -report=org.codenarc.report. HtmlReportWriter |
| -maxPriority1Violations=MAX    | The maximum number of priority 1 violations allowed (int).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | -maxPriority1Violations=0                                                                                                      |
| -maxPriority2Violations=MAX    | The maximum number of priority 2 violations allowed (int).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | -maxPriority2Violations=0                                                                                                      |
| -maxPriority3Violations=MAX    | The maximum number of priority 3 violations allowed (int).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | -maxPriority3Violations=0                                                                                                      |
| -title=REPORT TITLE            | The title for this analysis; used in the output report(s), if supported by the report type(s). Optional.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | -title="My Project"                                                                                                            |
| -help                          | Display the command-line help. If present, this must be the only command-line parameter.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | -help                                                                                                                          |


See OPTIONS in [CodeNarc documentation](http://codenarc.sourceforge.net/codenarc-command-line.html)

# EXAMPLES

```
    // npm-groovy-lint output

    $ npm-groovy-lint -report="xml:MyGroovyLinterReport.xml" --ngl-format=text


    // npm-groovy-lint output

    $ npm-groovy-lint -includes=**/Jenkinsfile -rulesetfiles="file:config/codenarc/RuleSet-Base.groovy" --ngl-format=json


    // CodeNarc output

    $ npm-groovy-lint -includes=**/Jenkinsfile -rulesetfiles="file:config/codenarc/RuleSet-All.groovy" -title="MyJenkinsfileLinterReport" -maxPriority1Violations=0 -report="html:MyJenkinsfileLinterReport.html"


    // CodeNarc output

    $ npm-groovy-lint -basedir="src" -rulesetfiles="file:config/codenarc/RuleSet-Base.groovy" -title="MyGroovyLinterReport" -maxPriority1Violations=0 -report="html:MyGroovyLinterReport.html"
```

# CONTRIBUTE

Contributions are very welcome !

- Fork the repo and clone it on your computer
- Run `npm run lint` then `npm run test` to check your updates
- Once your code is ready, documented and linted, please make a pull request :)

# THANKS

This package is just a bundle with a little script, it relies on :

- CodeNarc: https://github.com/CodeNarc/CodeNarc
- jdeploy : https://github.com/shannah/jdeploy
- slf4j : http://www.slf4j.org/
- log4j : https://logging.apache.org/log4j/2.x/
- GMetrics : https://dx42.github.io/gmetrics/


