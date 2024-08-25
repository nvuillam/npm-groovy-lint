<!-- markdownlint-disable MD013 MD033 MD034 -->
# NPM GROOVY LINT (+ Format & Auto-fix)

[![Version](https://img.shields.io/npm/v/npm-groovy-lint.svg)](https://npmjs.org/package/npm-groovy-lint)
[![Downloads/week](https://img.shields.io/npm/dw/npm-groovy-lint.svg)](https://npmjs.org/package/npm-groovy-lint)
[![Downloads/total](https://img.shields.io/npm/dt/npm-groovy-lint.svg)](https://npmjs.org/package/npm-groovy-lint)
[![Test](https://github.com/nvuillam/npm-groovy-lint/workflows/Test/badge.svg?branch=master)](https://github.com/nvuillam/npm-groovy-lint/actions?query=workflow%3ATest+branch%3Amaster)
[![codecov](https://codecov.io/gh/nvuillam/npm-groovy-lint/branch/master/graph/badge.svg)](https://codecov.io/gh/nvuillam/npm-groovy-lint)
[![Mega-Linter](https://github.com/nvuillam/npm-groovy-lint/actions/workflows/mega-linter.yml/badge.svg?branch=main)](https://github.com/nvuillam/npm-groovy-lint/actions/workflows/mega-linter.yml)
[![GitHub contributors](https://img.shields.io/github/contributors/nvuillam/npm-groovy-lint.svg)](https://gitHub.com/nvuillam/npm-groovy-lint/graphs/contributors/)
[![GitHub stars](https://img.shields.io/github/stars/nvuillam/npm-groovy-lint?label=Star&maxAge=2592000)](https://GitHub.com/nvuillam/npm-groovy-lint/stargazers/)
[![Docker Pulls](https://img.shields.io/docker/pulls/nvuillam/npm-groovy-lint)](https://hub.docker.com/r/nvuillam/npm-groovy-lint)
[![Docker Stars](https://img.shields.io/docker/stars/nvuillam/npm-groovy-lint)](https://hub.docker.com/r/nvuillam/npm-groovy-lint)
[![License](https://img.shields.io/npm/l/npm-groovy-lint.svg)](https://github.com/nvuillam/npm-groovy-lint/blob/master/package.json)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](http://makeapullrequest.com)

## Groovy & Jenkinsfile Linter, Formatter and Auto-fixer

***New: The [article about the story of npm-groovy-lint](https://nicolas.vuillamy.fr/a-groovy-journey-to-open-source-during-covid-19-npm-groovy-lint-8d88c7eecebc), and why you should dive in open-source community !***

Based on [CodeNarc](http://codenarc.github.io/CodeNarc/) , this out of the box package allows to **track groovy errors** and **correct a part of them**

- Use option **--format** to format & prettify source code
- Use option **--fix** to activate autofixing of fixable rules

Easy to integrate in a CI/CD process (Jenkins Pipeline,CircleCI...) to lint your groovy or Jenkinsfile at each build :)

You can also use this package in :

- [Visual Studio Code Groovy Lint extension](https://marketplace.visualstudio.com/items?itemName=NicolasVuillamy.vscode-groovy-lint)
- [Mega-Linter](https://nvuillam.github.io/mega-linter/) (can be used as GitHub Action, and lints all other languages and formats)
- [Docker Image](#other)

![image](https://github.com/nvuillam/npm-groovy-lint/raw/main/docs/assets/images/npm-groovy-lint-results.png)

See [CHANGELOG](https://github.com/nvuillam/npm-groovy-lint/blob/master/CHANGELOG.md)

Any **question**, **problem** or **enhancement request** ? Ask [**here**](https://github.com/nvuillam/npm-groovy-lint/issues) :)

## Usage

```shell
    npm-groovy-lint [OPTIONS] [FILES|PATH|PATTERN]
```

| Parameter               | Type    | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
|-------------------------|---------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| -o<br/> --output        | String  | Output format (txt,json,sarif,html,xml), or path to a file with one of these extensions<br/> Default: `txt`<br/> Examples:<br/> - `"txt"`<br/> - `"json"`<br/> - `"./logs/myLintResults.txt"`<br/> - `"./logs/myLintResults.sarif"`<br/> - `"./logs/myLintResults.html"`<br/> - `"./logs/myLintResults.xml"`<br/>Note: HTML and XML are directly from CodeNarc so using these formats will disable many npm-groovy-lint features                                                                                                                                              |
| -l<br/> --loglevel      | String  | Log level (error,warning or info)<br/>Default: info                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| --failon                | String  | Defines the error level where CLI will fail (return code = 1). error,warning,info or none. Each failure level includes the more critical ones.                                                                                                                                                                                                                                                                                                                                                                                                                                |
| -c<br/> --config        | String  | Custom path to [GroovyLint config file](#configuration), or preset config `recommended\|recommended-jenkinsfile\|all`<br/> Default: Browse current directory to find `.groovylintrc.json\|js\|yml\|package.json` config file, or default npm-groovy-lint config if not defined.<br/>Note: command-line arguments have priority on config file properties                                                                                                                                                                                                                            |
| --parse                 | Boolean | Try to compile the source code and return parse errors (since v5.7.0, default to true, use --no-parse to deactivate)                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| --format                | Boolean | Format source code                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| --fix                   | Boolean | Automatically fix problems when possible<br/> See [Auto-fixable rules](#auto-fixable-rules)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| -x<br/> --fixrules      | String  | Option for --fix argument: List of rule identifiers to fix (if not specified, all available fixes will be applied). See [Auto-fixable rules](#auto-fixable-rules) <br/> Examples:<br/> - `"SpaceBeforeClosingBrace,SpaceAfterClosingBrace,UnusedImport"`<br/> - `"Indentation"`<br/>                                                                                                                                                                                                                                                                                          |
| --nolintafter           | Boolean | When format or fix is called, a new lint is performed after the fixes to update the returned error list. If you just want the updated source code and do not care about the error logs, use this parameter to improve performances                                                                                                                                                                                                                                                                                                                                            |
| -r<br/> --rulesets      | String  | [RuleSet file(s)](http://codenarc.github.io/CodeNarc/codenarc-creating-ruleset.html) to use for linting, if you do not want to use recommended rules or .groovylintrc.js defined rules.<br/>If list of comma separated strings corresponding to CodeNarc rules, a RuleSet file will be dynamically generated </br>  Examples:<br/> - `"./config/codenarc/RuleSet-Custom.groovy"`<br/> - `"./path/to/my/ruleset/files"`<br/>- `Indentation{"spacesPerIndentLevel":2,"severity":"warning"},UnnecessarySemicolon,UnnecessaryGString`                                             |
| --rulesetsoverridetype  | String  | If list of rules sent in rulesets option, defines if they replace rules defined in .groovylintrc.json, or if they are appended<br/> Values: `replaceConfig` (default), `appendConfig`                                                                                                                                                                                                                                                                                                                                                                                         |
| -s<br/> --source        | String  | If path and files are not set, you can directly send the source code string to analyze                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| --verbose               | Boolean | More outputs in console, including performed fixes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| -i<br/> --ignorepattern | String  | Comma-separated list of Ant-style file patterns specifying files that must be ignored<br/> Default: none<br/> Example: `"**/test/*""`                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| --noserver              | Boolean | npm-groovy-lint launches a microservice to avoid performance issues caused by loading java/groovy each time,that auto kills itself after 1h idle. Use this argument if you do not want to use this feature                                                                                                                                                                                                                                                                                                                                                                    |
| --returnrules           | Boolean | Return rules descriptions and URL if set                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| --javaexecutable        | String  | Override java executable to use  <br/>Default: java<br/>Example: C:\\Program Files\\Java\\jdk1.8.0_144\\bin\\java.exe                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| --javaoptions           | String  | Override java options to use  <br/>Default: "-Xms256m,-Xmx2048m"                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| --insight               | Boolean | npm-groovy-lint collects anonymous usage statistics using [amplitude](https://www.npmjs.com/package/amplitude), in order to make new improvements based on how users use this package. <br/> Summary charts are available at [https://tinyurl.com/groovy-stats](https://tinyurl.com/groovy-stats).<br/> Analytics obviously does not receive sensitive information like your code, as you can see in analytics.js.<br/> If you want to enable anonymous usage statistics, use `--insight` option. |
| --codenarcargs          | String  | Use core CodeNarc arguments (all npm-groovy-lint arguments will be ignored)<br/> Doc: <http://codenarc.github.io/CodeNarc/codenarc-command-line.html><br/> Example: `npm-groovy-lint --codenarcargs -basedir="lib/example" -rulesetfiles="file:lib/example/RuleSet-Groovy.groovy" -maxPriority1Violations=0 -report="xml:ReportTestCodenarc.xml`                                                                                                                                                                                                                              |
| -h<br/> --help          | Boolean | Show help (npm-groovy-lint -h OPTIONNAME to see option detail with examples)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| -v<br/> --version       | Boolean | Show npm-groovy-lint version (with CodeNarc version)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| -p<br/> --path          | String  | (DEPRECATED) Directory containing the files to lint<br/> Example: `./path/to/my/groovy/files`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| -f<br/> --files         | String  | (DEPRECATED) Comma-separated list of Ant-style file patterns specifying files that must be included.<br/> Default: `"**/*.groovy,**/Jenkinsfile,**/*.gradle"`<br/>Examples:<br/> - `"**/Jenkinsfile"`<br/> - `"**/*.groovy"`<br/> - `"**/*.gradle"`<br/> - `"**/mySingleFile.groovy"`                                                                                                                                                                                                                                                                                         |

### Example calls

- Lint a file

```shell
    npm-groovy-lint path/to/my/groovy/file.groovy
```

- Lint multiple files

```shell
    npm-groovy-lint path/to/my/groovy/file.groovy path/to/my/groovy/file2.groovy path/to/my/groovy/file3.groovy
```

- Lint directory

```shell
    npm-groovy-lint path/to/my/groovy
```

- Lint pattern

```shell
    npm-groovy-lint path/to/my/groovy/*.groovy
```

- Lint groovy with JSON output

```shell
    npm-groovy-lint --output json
```

- Format files

```shell
    npm-groovy-lint --format my/path/to/file.groovy my/path/to/file2.groovy
```

- Format and fix files

```shell
    npm-groovy-lint --fix my/path/to/file.groovy my/path/to/file2.groovy
```

- Get formatted sources in stdout from stdin

```shell
    cat path/to/my/Jenkinsfile | npm-groovy-lint --format -
```

- Advanced config

```shell
    npm-groovy-lint --path "./path/to/my/groovy/files" --files "**/*.groovy" --config "./config/codenarc/.groovylintrcCustom.js" --loglevel warning --output txt
```

- Lint using core CodeNarc parameters and generate HTML report file

```shell
    npm-groovy-lint --codenarcargs -basedir="lib/example" -rulesetfiles="file:lib/example/RuleSet-Groovy.groovy" -title="TestTitleCodenarc" -maxPriority1Violations=0' -report="html:ReportTestCodenarc.html"
```

## Installation

```shell
    npm install -g npm-groovy-lint
```

- If you have issues with v9, install previous version with `npm install -g npm-groovy-lint@8.2.0`
- Node.js >= 12 is required to run this package. If you can't upgrade, you can use [nvm](https://github.com/nvm-sh/nvm) to have [different node versions on your computer](https://www.sitepoint.com/quick-tip-multiple-versions-node-nvm/)
- If you do not have java 17 installed on your computer, npm-groovy-lint will install them for you, so the first run may be long.

## Configuration

Default rules definition ([`recommended`](https://github.com/nvuillam/npm-groovy-lint/blob/master/lib/.groovylintrc-recommended.json), based on [`all`](https://github.com/nvuillam/npm-groovy-lint/blob/master/lib/.groovylintrc-all.json) tracks a lot of errors, do not hesitate to ignore some of them (like NoDef ou RequiredVariableType) if they are too mean for your project.

Create a file named **.groovylintrc.json** in the current or any parent directory of where your files to analyze are located

- your-repo-root-folder
  - src
    - groovy
      - mygroovyfile.groovy
  - Jenkinsfile
  - **.groovylintrc.json** *(do not forget the dot at the beginning of the file name)*

*If you are using [VsCode Groovy Lint extension](https://marketplace.visualstudio.com/items?itemName=NicolasVuillamy.vscode-groovy-lint), just use QuickFix **Ignore in all files** and it will generate groovylintrc.json file.*

### Format

- **extends**: Name of a base configuration ([`recommended`](https://github.com/nvuillam/npm-groovy-lint/blob/master/lib/.groovylintrc-recommended.json), [`recommended-jenkinsfile`](https://github.com/nvuillam/npm-groovy-lint/blob/master/lib/.groovylintrc-recommended-jenkinsfile.json), [`all`](https://github.com/nvuillam/npm-groovy-lint/blob/master/lib/.groovylintrc-all.json))
- **rules**: List of rules definition, following format `"RuleSection.RuleName": ruleParameters` or `"RuleName": ruleParameters`
  - *RuleName*: any of the **[CodeNarc rules](https://codenarc.github.io/CodeNarc/codenarc-rule-index.html)**
  - *ruleParameters*: can be just a severity override ( `"off"`, `"error"`, `"warning"`, `"info"` ) , or a property list :
    - severity : off,error,warning,info
    - enabled : true (default) or false
    - any of the [rule advanced properties](https://codenarc.github.io/CodeNarc/codenarc-rule-index.html)

OR

- **codenarcRulesets**: Comma-separated string containing the list of `.xml` or `.groovy` CodeNarc RuleSet files (in case you already are a CodeNarc user and do not wish to switch to npm-groovy-lint config format)

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

```json
{
    "codenarcRulesets": "RuleSet-1.groovy,RuleSet-2.groovy"
}
```

## Disabling rules in source

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

## Auto-Fixable rules

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

[Contribute](#contribute) to add more [rules](http://codenarc.github.io/CodeNarc/codenarc-rule-index.html) fixes :)

## CI/CD

### Mega-Linter

Latest npm-groovy-lint version is **natively integrated** in [**Mega-Linter**](https://nvuillam.github.io/mega-linter/), that you can use as GitHub action or in other CI tools
This tool can also **automatically apply fixes** on Pull Request branches

### CircleCI

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

### Jenkins

```groovy
node {
    checkout scm
    docker.image('nvuillam/npm-groovy-lint').inside {
        sh 'npm-groovy-lint'
    }
}
```

### Shell

Run with default settings

```shell
docker run --rm -u "$(id -u):$(id -g)" -w=/tmp -v "$PWD":/tmp nvuillam/npm-groovy-lint
```

Run with additional flags by simply appending them at after docker image name:

```shell
docker run --rm -u "$(id -u):$(id -g)" -w=/tmp -v "$PWD":/tmp nvuillam/npm-groovy-lint --failon warning --verbose
```

### Other

You can run npm-groovy-lint using its [official docker image](https://hub.docker.com/r/nvuillam/npm-groovy-lint)

## Use as module

You can import npm-groovy-lint into your NPM package and call lint & fix via module, using the same options than from npm-groovy-lint command line

Example

```shell
    npm install npm-groovy-lint --save
```

```javascript
    const NpmGroovyLint = require("npm-groovy-lint/lib/groovy-lint.js");
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

## Troubleshooting

If you have issues with MegaLinter, you can [report it on the repository](https://github.com/nvuillam/npm-groovy-lint/issues)

To help reproducing, you can access advanced logs using DEBUG env variables

Examples:

- `DEBUG=npm-groovy-lint npm-groovy-lint ....`
- `DEBUG=npm-groovy-lint,npm-groovy-lint-trace npm-groovy-lint ....`

If you want to see what happens in CodeNarc Server, you can clone the repo and run locally `npm server:run` before running npm-groovy-lint: you'll see the live logs of the to CodeNarc Server for npm-groovy-lint.

## Contribute

Contributions are very welcome !

Please follow [Contribution instructions](https://github.com/nvuillam/npm-groovy-lint/blob/master/CONTRIBUTING.md)

## Thanks

### Other packages used

- [CodeNarc](https://github.com/CodeNarc/CodeNarc): groovy lint
- [java-caller](https://www.npmjs.com/package/java-caller): Easy call Java commands from Node
- [slf4j](http://www.slf4j.org): logging for CodeNarc
- [log4j](https://logging.apache.org/log4j/2.x/): logging for CodeNarc
- [GMetrics](https://dx42.github.io/gmetrics/): Code measures for CodeNarc
- Inspiration from [eslint](https://eslint.org/) about configuration and run patterns

### Contributors

| [<img alt="nvuillam" src="https://avatars1.githubusercontent.com/u/17500430?v=4&s=50 width=50">](https://github.com/nvuillam) | [<img alt="Dave Gallant" src="https://avatars2.githubusercontent.com/u/4519234?v=4&s=50 width=50">](https://github.com/davegallant) | [<img alt="warhod" src="https://avatars1.githubusercontent.com/u/1305176?v=4&s=50 width=50">](https://github.com/warhod) | [<img alt="pawelkopka" src="https://avatars1.githubusercontent.com/u/17784034?v=4&s=50 width=50">](https://github.com/pawelkopka) | [<img alt="docwhat" src="https://avatars1.githubusercontent.com/u/40799?v=4&s=50 width=50">](https://github.com/docwhat) | [<img alt="CatSue" src="https://avatars3.githubusercontent.com/u/26134618?v=4&s=50 width=50">](https://github.com/CatSue) |
|:-----------------------------------------------------------------------------------------------------------------------------:|:-----------------------------------------------------------------------------------------------------------------------------------:|:------------------------------------------------------------------------------------------------------------------------:|:---------------------------------------------------------------------------------------------------------------------------------:|:------------------------------------------------------------------------------------------------------------------------:|:-------------------------------------------------------------------------------------------------------------------------:|
|                                        [Nicolas Vuillamy](https://github.com/nvuillam)                                        |                                           [Dave Gallant](https://github.com/davegallant)                                            |                                          [Howard Lo](https://github.com/warhod)                                          |                                           [Pawel Kopka](https://github.com/pawelkopka)                                            |                                          [docwhat](https://github.com/docwhat)                                           |                                            [CatSue](https://github.com/CatSue)                                            |

## Release notes

See complete [CHANGELOG](CHANGELOG.md)
