# NPM GROOVY LINT (and FIX !)

[![Version](https://img.shields.io/npm/v/npm-groovy-lint.svg)](https://npmjs.org/package/npm-groovy-lint)
[![Downloads/week](https://img.shields.io/npm/dw/npm-groovy-lint.svg)](https://npmjs.org/package/npm-groovy-lint) 
[![Downloads/total](https://img.shields.io/npm/dt/npm-groovy-lint.svg)](https://npmjs.org/package/npm-groovy-lint) 
[![CircleCI](https://circleci.com/gh/nvuillam/npm-groovy-lint/tree/master.svg?style=shield)](https://circleci.com/gh/nvuillam/npm-groovy-lint/tree/master)
[![codecov](https://codecov.io/gh/nvuillam/npm-groovy-lint/branch/master/graph/badge.svg)](https://codecov.io/gh/nvuillam/npm-groovy-lint)
[![GitHub contributors](https://img.shields.io/github/contributors/nvuillam/npm-groovy-lint.svg)](https://gitHub.com/nvuillam/npm-groovy-lint/graphs/contributors/)
[![GitHub stars](https://img.shields.io/github/stars/nvuillam/npm-groovy-lint?label=Star&maxAge=2592000)](https://GitHub.com/nvuillam/npm-groovy-lint/stargazers/)
[![License](https://img.shields.io/npm/l/npm-groovy-lint.svg)](https://github.com/nvuillam/npm-groovy-lint/blob/master/package.json) 
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](http://makeapullrequest.com)

**Groovy / Jenkinsfile linter and autofixer**

Based on [CodeNarc](http://codenarc.github.io/CodeNarc/) , this out of the box package allows to track groovy errors and correct a part of them

- Use option **--format** to format & prettify source code (beta)
- Use option **--fix** to activate autofixing of fixable rules (beta)

Easy to integrate in a CD/CI process (Jenkins Pipeline,CircleCI...) to lint your groovy or Jenkinsfile at each build :)

You can also use this package in [Visual Studio Code Groovy Lint extension](https://marketplace.visualstudio.com/items?itemName=NicolasVuillamy.vscode-groovy-lint)

![https://github.com/nvuillam/npm-groovy-lint/raw/master/doc/images/npm-groovy-lint-results.png](https://github.com/nvuillam/npm-groovy-lint/raw/master/doc/images/npm-groovy-lint-results.png)

See [CHANGELOG](https://github.com/nvuillam/npm-groovy-lint/blob/master/CHANGELOG.md)

Any **question**, **problem** or **enhancement request** ? Ask [**here**](https://github.com/nvuillam/npm-groovy-lint/issues) :)

# INSTALLATION

```
    $ npm install -g npm-groovy-lint
```

# USAGE

```
    $ npm-groovy-lint OPTIONS
```

| Parameter                | Type    | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
|--------------------------|---------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| -p<br/> --path           | String  | Directory containing the files to lint<br/> Example: `./path/to/my/groovy/files`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| -f<br/> --files          | String  | Comma-separated list of Ant-style file patterns specifying files that must be included.<br/> Default: `"**/*.groovy,**/Jenkinsfile"`<br/>Examples:<br/> - `"**/Jenkinsfile"`<br/> - `"**/*.groovy"`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| -o<br/> --output         | String  | Output format (txt,json,html,xml), or path to a file with one of these extensions<br/> Default: `txt`<br/> Examples:<br/> - `"txt"`<br/> - `"json"`<br/> - `"./logs/myLintResults.txt"`<br/> - `"./logs/myLintResults.json"`<br/> - `"./logs/myLintResults.html"`<br/> - `"./logs/myLintResults.xml"`                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| -l<br/> --loglevel       | String  | Log level (error,warning or info)<br/>Default: info                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| -c<br/> --config         | String  | Custom path to [GroovyLint config file](#Configuration)<br/> Default: Browse current directory to find groovylintrc.json/js/yml/package.json config file, or default npm-groovy-lint config if not defined.<br/>Note: command-line arguments have priority on config file properties                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| --fix                    | Boolean | (beta) Automatically fix problems when possible<br/> See [Autofixable rules](#Autofixable-rules)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| --format                 | Boolean | (beta) Format source code                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| -r<br/> --rulesets       | String  | [RuleSet file(s)](http://codenarc.github.io/CodeNarc/codenarc-creating-ruleset.html) to use for linting, if you do not want to use recommended rules or .groovylintrc.js defined rules.<br/>If list of comma separated strings corresponding to CodeNarc rules, a RuleSet file will be dynamically generated </br>  Examples:<br/> - `"./config/codenarc/RuleSet-Custom.groovy"`<br/> - `"./path/to/my/ruleset/files"`<br/>- `EmptyInstanceInitializer,EmptySwitchStatement,ForLoopShouldBeWhileLoop`                                                                                                                                                                                                                                                                             |
| -s<br/> --source         | String  | If path and files are not set, you can directly send the source code string to analyze                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| -v<br/> --verbose        | Boolean | More outputs in console, including performed fixes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| -i<br/> --ignorepattern  | String  | Comma-separated list of Ant-style file patterns specifying files that must be ignored<br/> Default: none<br/> Example: `"**/test/*""`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| --failonerror            | Boolean | Fails if at least one error is found                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| --failonwarning          | Boolean | Fails if at least one warning is found                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| --noserver               | Boolean | npm-groovy-lint launches a microservice to avoid performance issues caused by loading jaja/groovy everytime,that auto kills itself after 1h idle. Use this argument if you do not want to use this feature                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| --failoninfo             | Boolean | Fails if at least one error is found                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| --codenarcargs           | Boolean | Use core CodeNarc arguments (all npm-groovy-lint arguments will be ignored)<br/> Doc: http://codenarc.github.io/CodeNarc/codenarc-command-line.html<br/> Example: `npm-groovy-lint --codenarcargs -basedir="jdeploy-bundle/lib/example" -rulesetfiles="file:jdeploy-bundle/lib/example/RuleSet-Groovy.groovy" -maxPriority1Violations=0 -report="xml:ReportTestCodenarc.xml`                                                                                                                                                                                                                                                                                                                                                                                                      |
| -h<br/> --help           | Boolean | Show help (npm-groovy-lint -h OPTIONNAME to see option detail with examples)                                                                                                                                                                                                                                                                                                                                 

# CONFIGURATION

Define a file named **.groovylintrc.json** (or .js or .YAML, or include in a property groovyLintConfig in package.json)

Format : 

- extends: Name of a base configuration ([`recommended`](https://github.com/nvuillam/npm-groovy-lint/blob/master/.groovylintrc-recommended.json) or [`all`](https://github.com/nvuillam/npm-groovy-lint/blob/master/.groovylintrc-all.json))
- rules: List of rules definition, following format `"RuleSection.RuleName": ruleParameters` or `"RuleName": ruleParameters`
    - "RuleSection.RuleName": any of the **[CodeNarc rules](https://codenarc.github.io/CodeNarc/codenarc-rule-index.html)** 
    - ruleParameters: can be just a severity override ( `"off"`, `"error"`, `"warning"`, `"info"` ) , or a property list :
        - severity : off,error,warning,info
        - enabled : true (default) or false
        - any of the [rule advanced properties](https://codenarc.github.io/CodeNarc/codenarc-rule-index.html)

Example:

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

# EXAMPLES

- Lint groovy with JSON output
```
    $ npm-groovy-lint --output json
```

- Advanced config
```
    $ npm-groovy-lint --path "./path/to/my/groovy/files" --files "**/*.groovy" --config "./config/codenarc/.groovylintrcCustom.js" --loglevel warning --output txt
```

- Lint using core CodeNarc parameters and generate HTML report file

```
    $ npm-groovy-lint --codenarcargs -basedir="jdeploy-bundle/lib/example" -rulesetfiles="file:jdeploy-bundle/lib/example/RuleSet-Groovy.groovy" -title="TestTitleCodenarc" -maxPriority1Violations=0' -report="html:ReportTestCodenarc.html"
```

# Autofixable rules (beta)

- BlockEndsWithBlankLine
- BlockStartsWithBlankLine
- ConsecutiveBlankLines
- FileEndsWithoutNewline
- IfStatementBraces
- Indentation (IfStatementBraces and ElsefStatementBraces must be fixed to have correct indentation)
- MisorderedStaticImports
- NoTabCharacter
- SpaceAfterCatch
- SpaceAfterComma
- SpaceAfterIf
- SpaceAfterOpeningBrace
- SpaceAroundOperator
- SpaceBeforeOpeningBrace
- TrailingWhitespace
- UnnecessaryDefInFieldDeclaration
- UnnecessaryGroovyImport
- UnnecessaryGString
- UnnecessarySemicolon
- UnnecessaryToString
- UnusedImport


[Contribute](#Contribute) to add more [rules](http://codenarc.github.io/CodeNarc/codenarc-rule-index.html) fixes :)

# Call via JS module

You can import npm-groovy-lint into your NPM package and call lint & fix via module, using the same options than from npm-groovy-lint command line

Example
```
    $ npm install npm-groovy-lint --save
```

```javascript
    const NpmGroovyLint = require("npm-groovy-lint/jdeploy-bundle/groovy-lint.js");
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

# TROUBLESHOOTING

- Embedded Groovy 3.0.2 may have issues with JDK12, please use JDK11 or a precedent version if possible
- CodeNarc server does not seems to Work on some Linux environments (java classes are loaded at each npm-groovy-lint call so performances are slower)
- On some environments, it has been observed that installed Groovy version must match Groovy embedded jars delivered with npm-groovy-lint (3.0.2)

# CONTRIBUTE

Contributions are very welcome !

Please follow [Contribution instructions](https://github.com/nvuillam/npm-groovy-lint/blob/master/CONTRIBUTE.md)

# THANKS

This package uses :

- CodeNarc : https://github.com/CodeNarc/CodeNarc (groovy lint)
- jdeploy : https://github.com/shannah/jdeploy (jar deployment and run)
- slf4j : http://www.slf4j.org/ (logging for CodeNarc)
- log4j : https://logging.apache.org/log4j/2.x/ (logging for CodeNarc)
- GMetrics : https://dx42.github.io/gmetrics/ (Code mesures for CodeNarc)
- Inspiration from [eslint](https://eslint.org/) about configuration and run patterns


