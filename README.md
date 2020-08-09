<!-- markdownlint-disable MD033 -->
# NPM GROOVY LINT (+ Format & Auto-fix)

[![Version](https://img.shields.io/npm/v/npm-groovy-lint.svg)](https://npmjs.org/package/npm-groovy-lint)
[![Downloads/week](https://img.shields.io/npm/dw/npm-groovy-lint.svg)](https://npmjs.org/package/npm-groovy-lint)
[![Downloads/total](https://img.shields.io/npm/dt/npm-groovy-lint.svg)](https://npmjs.org/package/npm-groovy-lint)
[![CircleCI](https://circleci.com/gh/nvuillam/npm-groovy-lint/tree/master.svg?style=shield)](https://circleci.com/gh/nvuillam/npm-groovy-lint/tree/master)
[![codecov](https://codecov.io/gh/nvuillam/npm-groovy-lint/branch/master/graph/badge.svg)](https://codecov.io/gh/nvuillam/npm-groovy-lint)
[![GitHub contributors](https://img.shields.io/github/contributors/nvuillam/npm-groovy-lint.svg)](https://gitHub.com/nvuillam/npm-groovy-lint/graphs/contributors/)
[![GitHub stars](https://img.shields.io/github/stars/nvuillam/npm-groovy-lint?label=Star&maxAge=2592000)](https://GitHub.com/nvuillam/npm-groovy-lint/stargazers/)
[![Docker Pulls](https://img.shields.io/docker/pulls/nvuillam/npm-groovy-lint)](https://hub.docker.com/r/nvuillam/npm-groovy-lint)
[![Docker Stars](https://img.shields.io/docker/stars/nvuillam/npm-groovy-lint)](https://hub.docker.com/r/nvuillam/npm-groovy-lint)
[![License](https://img.shields.io/npm/l/npm-groovy-lint.svg)](https://github.com/nvuillam/npm-groovy-lint/blob/master/package.json)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](http://makeapullrequest.com)

## Groovy & Jenkinsfile Linter, Formatter and Auto-fixer

Based on [CodeNarc](http://codenarc.github.io/CodeNarc/) , this out of the box package allows to **track groovy errors** and **correct a part of them**

- Use option **--format** to format & prettify source code (beta)
- Use option **--fix** to activate autofixing of fixable rules (beta)

Easy to integrate in a CD/CI process (Jenkins Pipeline,CircleCI...) to lint your groovy or Jenkinsfile at each build :)

You can also use this package in [Visual Studio Code Groovy Lint extension](https://marketplace.visualstudio.com/items?itemName=NicolasVuillamy.vscode-groovy-lint) and [Docker Image](#CALL-VIA-DOCKER)

![https://github.com/nvuillam/npm-groovy-lint/raw/master/doc/images/npm-groovy-lint-results.png](https://github.com/nvuillam/npm-groovy-lint/raw/master/doc/images/npm-groovy-lint-results.png)

See [CHANGELOG](https://github.com/nvuillam/npm-groovy-lint/blob/master/CHANGELOG.md)

Any **question**, **problem** or **enhancement request** ? Ask [**here**](https://github.com/nvuillam/npm-groovy-lint/issues) :)

## INSTALLATION

```shell
    npm install -g npm-groovy-lint
```

Node.js >= 12 is required to run this package. If you can't upgrade, you can use [nvm](https://github.com/nvm-sh/nvm) to have [different node versions on your computer](https://www.sitepoint.com/quick-tip-multiple-versions-node-nvm/)

## USAGE

```shell
    npm-groovy-lint OPTIONS
```

| Parameter                | Type    | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
|--------------------------|---------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| -p<br/> --path           | String  | Directory containing the files to lint<br/> Example: `./path/to/my/groovy/files`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| -f<br/> --files          | String  | Comma-separated list of Ant-style file patterns specifying files that must be included.<br/> Default: `"**/*.groovy,**/Jenkinsfile,**/*.gradle"`<br/>Examples:<br/> - `"**/Jenkinsfile"`<br/> - `"**/*.groovy"`<br/> - `"**/*.gradle"`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| -o<br/> --output         | String  | Output format (txt,json,html,xml), or path to a file with one of these extensions<br/> Default: `txt`<br/> Examples:<br/> - `"txt"`<br/> - `"json"`<br/> - `"./logs/myLintResults.txt"`<br/> - `"./logs/myLintResults.json"`<br/> - `"./logs/myLintResults.html"`<br/> - `"./logs/myLintResults.xml"`                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| -l<br/> --loglevel       | String  | Log level (error,warning or info)<br/>Default: info                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| --failon                 | String  | Defines the error level where CLI will fail (return code = 1). error,warning,info or none. Each failure level includes the more critical ones.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| -c<br/> --config         | String  | Custom path to [GroovyLint config file](#Configuration), or preset config `recommended|recommended-jenkinsfile|all`<br/> Default: Browse current directory to find `.groovylintrc.json|js|yml|package.json` config file, or default npm-groovy-lint config if not defined.<br/>Note: command-line arguments have priority on config file properties                                                                                                                                                                                                                                                                                                                                                                                                                               |
| --parse                  | Boolean | Try to compile the source code and return parse errors (since v5.7.0, default to true, use --no-parse to deactivate)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| --format                 | Boolean | (beta) Format source code                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| --fix                    | Boolean | (beta) Automatically fix problems when possible<br/> See [Autofixable rules](#Autofixable-rules)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| -x<br/> --fixrules       | String  | Option for --fix argument: List of rule identifiers to fix (if not specified, all available fixes will be applied). See [Autofixable rules](#Autofixable-rules) <br/> Examples:<br/> - `"SpaceBeforeClosingBrace,SpaceAfterClosingBrace,UnusedImport"`<br/> - `"Indentation"`<br/>                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| --nolintafter            | Boolean | When format or fix is called, a new lint is performed after the fixes to update the returned error list. If you just want the updated source code and do not care about the error logs, use this parameter to improve performances                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| -r<br/> --rulesets       | String  | [RuleSet file(s)](http://codenarc.github.io/CodeNarc/codenarc-creating-ruleset.html) to use for linting, if you do not want to use recommended rules or .groovylintrc.js defined rules.<br/>If list of comma separated strings corresponding to CodeNarc rules, a RuleSet file will be dynamically generated </br>  Examples:<br/> - `"./config/codenarc/RuleSet-Custom.groovy"`<br/> - `"./path/to/my/ruleset/files"`<br/>- `Indentation{"spacesPerIndentLevel":2,"severity":"warning"},UnnecessarySemicolon,UnnecessaryGString`                                                                                                                                                                                                                                                 |
| --rulesetsoverridetype   | String  | If list of rules sent in rulesets option, defines if they replace rules defined in .groovylintrc.json, or if they are appended<br/> Values: `replaceConfig` (default), `appendConfig`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| -s<br/> --source         | String  | If path and files are not set, you can directly send the source code string to analyze                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| -v<br/> --verbose        | Boolean | More outputs in console, including performed fixes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| -i<br/> --ignorepattern  | String  | Comma-separated list of Ant-style file patterns specifying files that must be ignored<br/> Default: none<br/> Example: `"**/test/*""`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| --noserver               | Boolean | npm-groovy-lint launches a microservice to avoid performance issues caused by loading java/groovy each time,that auto kills itself after 1h idle. Use this argument if you do not want to use this feature                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| --returnrules            | Boolean | Return rules descriptions and URL if set                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| --javaexecutable         | String  | Override java executable to use  <br/>Default: java<br/>Example: C:\\Program Files\\Java\\jdk1.8.0_144\\bin\\java.exe                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| --javaoptions            | String  | Override java options to use  <br/>Default: "-Xms256m,-Xmx2048m"                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| --no-insight             | Boolean | npm-groovy-lint collects anonymous usage statistics using [analytics](https://www.npmjs.com/package/analytics) & [@analytics-segment](https://github.com/DavidWells/analytics/tree/master/packages/analytics-plugin-segment), in order to make new improvements based on how users use this package. Analytics obviously does not receive sensitive information like your code, as you can see in [analytics.js](https://github.com/nvuillam/npm-groovy-lint/blob/master/src/analytics.js). If you want to disable anonymous usage statistics, use `--no-insight` option.                                                                                                                                                                                                         |
| --codenarcargs           | String  | Use core CodeNarc arguments (all npm-groovy-lint arguments will be ignored)<br/> Doc: <http://codenarc.github.io/CodeNarc/codenarc-command-line.html><br/> Example: `npm-groovy-lint --codenarcargs -basedir="lib/example" -rulesetfiles="file:lib/example/RuleSet-Groovy.groovy" -maxPriority1Violations=0 -report="xml:ReportTestCodenarc.xml`                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| -h<br/> --help           | Boolean | Show help (npm-groovy-lint -h OPTIONNAME to see option detail with examples)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |

## CONFIGURATION

Default rules definition ([`recommended`](https://github.com/nvuillam/npm-groovy-lint/blob/master/lib/.groovylintrc-recommended.json), based on [`all`](https://github.com/nvuillam/npm-groovy-lint/blob/master/lib/.groovylintrc-all.json) tracks a lot of errors, do not hesitate to ignore some of them (like NoDef ou RequiredVariableType) if they are too mean for your project.

Create a file named **.groovylintrc.json** in the current or any parent directory of where your files to analyze are located

- your-repo-root-folder
  - src
    - groovy
      - mygroovyfile.groovy
  - Jenkinsfile
  - **.groovylintrc.json** _(do not forget the dot at the beginning of the file name)_

*If you are using [VsCode Groovy Lint extension](https://marketplace.visualstudio.com/items?itemName=NicolasVuillamy.vscode-groovy-lint), just use QuickFix* ***Ignore in all files*** *and it will generate groovylintrc.json file*

### Format

- **extends**: Name of a base configuration ([`recommended`](https://github.com/nvuillam/npm-groovy-lint/blob/master/lib/.groovylintrc-recommended.json), [`recommended-jenkinsfile`](https://github.com/nvuillam/npm-groovy-lint/blob/master/lib/.groovylintrc-recommended-jenkinsfile.json), [`all`](https://github.com/nvuillam/npm-groovy-lint/blob/master/lib/.groovylintrc-all.json))
- **rules**: List of rules definition, following format `"RuleSection.RuleName": ruleParameters` or `"RuleName": ruleParameters`
  - _RuleName_: any of the **[CodeNarc rules](https://codenarc.github.io/CodeNarc/codenarc-rule-index.html)**
  - _ruleParameters_: can be just a severity override ( `"off"`, `"error"`, `"warning"`, `"info"` ) , or a property list :
    - severity : off,error,warning,info
    - enabled : true (default) or false
    - any of the [rule advanced properties](https://codenarc.github.io/CodeNarc/codenarc-rule-index.html)

### Examples

```json
{
    "extends": "recommended",
    "rules": {
        "comments.ClassJavadoc": "off",
        "formatting.Indentation": {
            "spacesPerIndentLevel": 4,
            "severity": "info"
        },
        "UnnecessaryReturnKeyword": "error"
    }
}
```

```json
{
    "extends": "recommended-jenkinsfile",
    "rules": {
        "CouldBeElvis": "off",
        "CouldBeSwitchStatement": "off",
        "VariableName": {
            "severity": "info"
        }
    }
}
```

## EXAMPLES

- Lint groovy with JSON output

```shell
    npm-groovy-lint --output json
```

- Advanced config

```shell
    npm-groovy-lint --path "./path/to/my/groovy/files" --files "**/*.groovy" --config "./config/codenarc/.groovylintrcCustom.js" --loglevel warning --output txt
```

- Lint using core CodeNarc parameters and generate HTML report file

```shell
    npm-groovy-lint --codenarcargs -basedir="lib/example" -rulesetfiles="file:lib/example/RuleSet-Groovy.groovy" -title="TestTitleCodenarc" -maxPriority1Violations=0' -report="html:ReportTestCodenarc.html"
```

## DISABLING RULES IN SOURCE

You can disable rules directly by adding comment in file, using [eslint style](https://eslint.org/docs/user-guide/configuring#disabling-rules-with-inline-comments)

To temporarily disable rule warnings in your file, use block comments in the following format:

```groovy
/* groovylint-disable */

def variable = 1;

/* groovylint-enable */
```

You can also disable or enable warnings for specific rules:

```groovy
/* groovylint-disable NoDef, UnnecessarySemicolon */

def variable = 1;

/* groovylint-enable NoDef, UnnecessarySemicolon */
```

To disable rule warnings in an entire file, put a `/* groovylint-disable */` block comment at the top of the file:

```groovy
/* groovylint-disable */

def variable = 1;
```

You can also disable or enable specific rules for an entire file:

```groovy
/* groovylint-disable NoDef */

def variable = 1;
```

To disable all rules on a specific line, use a line or block comment in one of the following formats:

```groovy
def variable = 1; // groovylint-disable-line

// groovylint-disable-next-line
def variable = 1;

/* groovylint-disable-next-line */
def variable = 1;

def variable = 1; /* groovylint-disable-line */
```

To disable a specific rule on a specific line:

```groovy
def variable = 1; // groovylint-disable-line NoDef

// groovylint-disable-next-line NoDef
def variable = 1;

def variable = 1; /* groovylint-disable-line NoDef */

/* groovylint-disable-next-line NoDef */
def variable = 1;
```

To disable multiple rules on a specific line:

```groovy
def variable = 1; // groovylint-disable-line NoDef, UnnecessarySemicolon

// groovylint-disable-next-line NoDef, UnnecessarySemicolon
def variable = 1;

def variable = 1; /* groovylint-disable-line NoDef, UnnecessarySemicolon */

/* groovylint-disable-next-line NoDef, UnnecessarySemicolon */
def variable = 1;
```

## AUTO-FIXABLE RULES (beta)

- AssignmentInConditional
- BlankLineBeforePackage
- BlockEndsWithBlankLine
- BlockStartsWithBlankLine
- BracesForClass
- BracesForForLoop
- BracesForIfElse
- BracesForMethod
- BracesForTryCatchFinally
- ClassEndsWithBlankLine
- ClassStartsWithBlankLine
- ClosingBraceNotAlone
- ConsecutiveBlankLines
- DuplicateImport
- ElseBlockBraces
- ExplicitArrayListInstantiation
- ExplicitLinkedListInstantiation
- FileEndsWithoutNewline
- IfStatementBraces
- Indentation
- IndentationClosingBraces
- IndentationComments
- InsecureRandom
- MisorderedStaticImports
- MissingBlankLineAfterImports
- MissingBlankLineAfterPackage
- NoTabCharacter
- SpaceAfterCatch
- SpaceAfterComma
- SpaceAfterFor
- SpaceAfterIf
- SpaceAfterOpeningBrace
- SpaceAfterSemicolon
- SpaceAfterSwitch
- SpaceAfterWhile
- SpaceAroundOperator
- SpaceBeforeClosingBrace
- SpaceBeforeOpeningBrace
- TrailingWhitespace
- UnnecessaryDefInFieldDeclaration
- UnnecessaryDefInMethodDeclaration
- UnnecessaryDefInVariableDeclaration
- UnnecessaryDotClass
- UnnecessaryFinalOnPrivateMethod
- UnnecessaryGString
- UnnecessaryGroovyImport
- UnnecessaryPackageReference
- UnnecessaryParenthesesForMethodCallWithClosure
- UnnecessarySemicolon
- UnnecessaryToString
- UnusedImport

[Contribute](#Contribute) to add more [rules](http://codenarc.github.io/CodeNarc/codenarc-rule-index.html) fixes :)

## CALL VIA DOCKER

You can run npm-groovy-lint using its [official docker image](https://hub.docker.com/r/nvuillam/npm-groovy-lint)

### Shell example

```shell
docker run -u "$(id -u):$(id -g)" -w=/tmp -v "$PWD":/tmp nvuillam/npm-groovy-lint
```

### CircleCI example

```yaml
# .circleci/config.yml
version: 2.1
jobs:
  lint:
    docker:
      - image: nvuillam/npm-groovy-lint
    steps:
      - checkout

      - run: |
          npm-groovy-lint

workflows:
  version: 2
  "lint":
    jobs:
       - lint
```

### Jenkinsfile example

```groovy
node {
    checkout scm
    docker.image('nvuillam/npm-groovy-lint').inside {
        sh 'npm-groovy-lint'
    }
}
```

## CALL VIA JS MODULE

You can import npm-groovy-lint into your NPM package and call lint & fix via module, using the same options than from npm-groovy-lint command line

Example

```shell
    npm install npm-groovy-lint --save
```

```javascript
    const NpmGroovyLint = require("npm-groovy-lint/groovy-lint.js");
    const fse = require("fs-extra");

    const npmGroovyLintConfig = {
        source: fse.readFileSync('./lib/example/SampleFile.groovy').toString(),
        fix: true,
        loglevel: 'warning',
        output: 'none'
    };
    const linter = new NpmGroovyLint(npmGroovyLintConfig, {});
    await linter.run();
    console.log(JSON.stringify(linter.lintResult));
```

## TROUBLESHOOTING

- On some environments, it has been observed that installed Groovy version must match Groovy embedded jars delivered with npm-groovy-lint (Groovy 3.0.5)

## CONTRIBUTE

Contributions are very welcome !

Please follow [Contribution instructions](https://github.com/nvuillam/npm-groovy-lint/blob/master/CONTRIBUTING.md)

## THANKS

This package uses :

- [CodeNarc](https://github.com/CodeNarc/CodeNarc): groovy lint
- [slf4j](http://www.slf4j.org): logging for CodeNarc
- [log4j](https://logging.apache.org/log4j/2.x/): logging for CodeNarc
- [GMetrics](https://dx42.github.io/gmetrics/): Code measures for CodeNarc
- Inspiration from [eslint](https://eslint.org/) about configuration and run patterns

[<img alt="nvuillam" src="https://avatars1.githubusercontent.com/u/17500430?v=4&s=50 width=50">](https://github.com/nvuillam) |[<img alt="Dave Gallant" src="https://avatars2.githubusercontent.com/u/4519234?v=4&s=50 width=50">](https://github.com/davegallant) |[<img alt="docwhat" src="https://avatars1.githubusercontent.com/u/40799?v=4&s=50 width=50">](https://github.com/docwhat) |[<img alt="CatSue" src="https://avatars3.githubusercontent.com/u/26134618?v=4&s=50 width=50">](https://github.com/CatSue) |
:---:|:---:|:---:|:---:|
[nvuillam](https://github.com/nvuillam)|[Dave Gallant](https://github.com/davegallant)|[docwhat](https://github.com/docwhat)|[CatSue](https://github.com/CatSue)|

## RELEASE NOTES

### [7.1.0] 2020-08-10

- Externalize JavaCaller class into a separate package [java-caller](https://www.npmjs.com/package/java-caller) and use it

### [7.0.0] 2020-08-07

- New default recommended rules (activate/deactivate/change severity)
- Allow to call `--config recommended-jenkinsfile` to use delivered .groovylintrc-recommended-jenkinsfile.json

### [6.1.1] 2020-08-04

- Fix SpaceAfterComma auto-fixing rule

### [6.1.0] 2020-08-04

- Java 14 compatibility (Closes [#77](https://github.com/nvuillam/npm-groovy-lint/issues/7))

### [6.0.0] 2020-08-03

- Upgrade to [CodeNarc v1.6.1](https://github.com/CodeNarc/CodeNarc/blob/v1.6-patch-releases/CHANGELOG.md#version-161----aug-2020)
- Upgrade to [GMetrics v1.1](https://github.com/dx42/gmetrics/blob/master/CHANGELOG.md#version-11-may-2020)
- Upgrade to [Groovy v3.0.5](https://groovy-lang.org/)

### PREVIOUS VERSIONS

See complete [CHANGELOG](https://github.com/nvuillam/npm-groovy-lint/blob/master/CHANGELOG.md)
