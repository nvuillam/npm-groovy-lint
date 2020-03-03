# NPM GROOVY LINT (and FIX !)

[![Version](https://img.shields.io/npm/v/npm-groovy-lint.svg)](https://npmjs.org/package/npm-groovy-lint)
[![Downloads/week](https://img.shields.io/npm/dw/npm-groovy-lint.svg)](https://npmjs.org/package/npm-groovy-lint) 
[![Downloads/total](https://img.shields.io/npm/dt/npm-groovy-lint.svg)](https://npmjs.org/package/npm-groovy-lint) 
[![CircleCI](https://circleci.com/gh/nvuillam/npm-groovy-lint/tree/master.svg?style=shield)](https://circleci.com/gh/nvuillam/npm-groovy-lint/tree/master)
[![codecov](https://codecov.io/gh/nvuillam/npm-groovy-lint/branch/master/graph/badge.svg)](https://codecov.io/gh/nvuillam/npm-groovy-lint)
[![GitHub contributors](https://img.shields.io/github/contributors/nvuillam/npm-groovy-lint.svg)](https://gitHub.com/nvuillam/npm-groovy-lint/graphs/contributors/)
[![GitHub stars](https://img.shields.io/github/stars/nvuillam/npm-groovy-lint?label=Star&maxAge=2592000)](https://GitHub.com/nvuillam/npm-groovy-lint/stargazers/)
[![License](https://img.shields.io/npm/l/npm-groovy-lint.svg)](https://github.com/nvuillam/npm-groovy-lint/blob/master/package.json) 
[![HitCount](https://hits.dwyl.com/nvuillam/npm-groovy-lint.svg)](https://hits.dwyl.com/nvuillam/npm-groovy-lint)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](http://makeapullrequest.com)
[![Say Thanks!](https://img.shields.io/badge/Say%20Thanks-!-1EAEDB.svg)](https://saythanks.io/to/nicolas.vuillamy@gmail.com)

**Groovy / Jenkinsfile linter and autofixer**

Based on [CodeNarc](http://codenarc.github.io/CodeNarc/) , this out of the box package allows to track groovy errors and correct a part of them

Use option **--fix** to activate autofixing (the function is still in experimental phase, you may have to run it several times at first so CodeNarc take in account the updates)

Easy to integrate in a CD/CI process (Jenkins Pipeline,CircleCI...) to lint your groovy or Jenkinsfile at each build :)

![https://github.com/nvuillam/npm-groovy-lint/raw/master/doc/images/npm-groovy-lint-results.png](https://github.com/nvuillam/npm-groovy-lint/raw/master/doc/images/npm-groovy-lint-results.png)

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
| -f<br/> --files          | String  | Comma-separated list of Ant-style file patterns specifying files that must be included.<br/> Default: `"**/*.groovy,**/Jenkinsfile"`, or `"**/*.groovy"` if --rulesets Groovy, or `**/Jenkinsfile` if --rulesets Jenkinsfile <br/> Examples: <br/> - `"**/Jenkinsfile"<br/>` - `"*/*.groovy"`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| -r<br/> --rulesets       | String  | RuleSet file(s) to use for linting. If it is a directory, all rulesets will be used.<br/> RuleSet file definition: http://codenarc.github.io/CodeNarc/codenarc-creating-ruleset.html.<br/> If not specified, npm-groovy-script default ones will be used depending on file types found in --path:<br/> - [Groovy recommended rules](https://github.com/nvuillam/npm-groovy-lint/blob/master/lib/example/RuleSet-Groovy.groovy), also usable with `--rulesets Groovy`<br/> - [Jenkinsfile recommended rules](https://github.com/nvuillam/npm-groovy-lint/blob/master/lib/example/RuleSet-Jenkinsfile.groovy), also usable with `--rulesets Jenkinsfile`<br/>  Examples:<br/> - `"./config/codenarc/RuleSet-Custom.groovy"`<br/> - `"./path/to/my/ruleset/files"`<br/> - `Jenkinsfile` |
| -o<br/> --output         | String  | Output format (txt,json,html,xml), or path to a file with one of these extensions<br/> Default: `txt`<br/> Examples:<br/> - `"txt"`<br/> - `"json"`<br/> - `"./logs/myLintResults.txt"`<br/> - `"./logs/myLintResults.json"`<br/> - `"./logs/myLintResults.html"`<br/> - `"./logs/myLintResults.xml"`                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| -l<br/> --loglevel       | String  | Log level (error,warning or info)<br/>Default: info                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| -v<br/> --verbose        | Boolean | More outputs in console, including performed fixes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| --fix                    | Boolean | (Experimental) Automatically fix problems when possible<br/> See [Autofixable rules](#Autofixable-rules)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| -i<br/> --ignorepattern  | String  | Comma-separated list of Ant-style file patterns specifying files that must be ignored<br/> Default: none<br/> Example: `"**/test/*""`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| --failonerror            | Boolean | Fails if at least one error is found                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| --failonwarning          | Boolean | Fails if at least one warning is found                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| --noserver               | Boolean | npm-groovy-lint launches a microservice to avoid performance issues caused by loading jaja/groovy everytime,that auto kills itself after 1h idle. Use this argument if you do not want to use this feature                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| --failoninfo             | Boolean | Fails if at least one error is found                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| --codenarcargs           | Boolean | Use core CodeNarc arguments (all npm-groovy-lint arguments will be ignored)<br/> Doc: http://codenarc.github.io/CodeNarc/codenarc-command-line.html<br/> Example: `npm-groovy-lint --codenarcargs -basedir="jdeploy-bundle/lib/example" -rulesetfiles="file:jdeploy-bundle/lib/example/RuleSet-Groovy.groovy" -maxPriority1Violations=0 -report="xml:ReportTestCodenarc.xml`                                                                                                                                                                                                                                                                                                                                                                                                      |
| -h<br/> --help           | Boolean | Show help (npm-groovy-lint -h OPTIONNAME to see option detail with examples)                                                                                                                                                                                                                                                                                                                                 
# EXAMPLES

- Lint a Jenkinsfile

```
    $ npm-groovy-lint --rulesets Jenkinsfile
```

- Lint groovy files

```
    $ npm-groovy-lint --rulesets Groovy
```

- Lint and fix a Jenkinsfile 

```
    $ npm-groovy-lint --rulesets Jenkinsfile --fix
```

- Lint groovy with JSON output
```
    $ npm-groovy-lint --rulesets Groovy --output json
```

- Advanced config
```
    $ npm-groovy-lint --path "./path/to/my/groovy/files" --files "**/*.groovy" --rulesets "./config/codenarc/RuleSet-Custom.groovy" --loglevel warning --output txt
```

- Lint using core CodeNarc parameters and generate HTML report file

```
    $ npm-groovy-lint --codenarcargs -basedir="jdeploy-bundle/lib/example" -rulesetfiles="file:jdeploy-bundle/lib/example/RuleSet-Groovy.groovy" -title="TestTitleCodenarc" -maxPriority1Violations=0' -report="html:ReportTestCodenarc.html"
```

# Autofixable rules (experimental)

- ConsecutiveBlankLines
- Indentation (IfStatementBraces and ElsefStatementBraces must be manually fixed to have correct indentation)
- NoTabCharacter
- SpaceAfterCatch
- SpaceAfterOpeningBrace
- SpaceAroundOperator
- SpaceAfterComma
- SpaceBeforeOpeningBrace
- UnnecessaryDefInFieldDeclaration
- UnnecessaryGString
- UnnecessarySemicolon
- TrailingWhitespace

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

- Embedded Groovy 3.0.1 has issues with JDK12, please use JDK11 or a precedent version if possible

# CONTRIBUTE

Contributions are very welcome !

- Fork the repo and clone it on your computer
- Run `npm run lint` then `npm run test` to check your updates didn't break anything
- Once your code is ready, documented and testing, please make a pull request :)

# THANKS

This package uses :

- CodeNarc : https://github.com/CodeNarc/CodeNarc (groovy lint)
- jdeploy : https://github.com/shannah/jdeploy (jar deployment and run)
- slf4j : http://www.slf4j.org/ (logging for CodeNarc)
- log4j : https://logging.apache.org/log4j/2.x/ (logging for CodeNarc)
- GMetrics : https://dx42.github.io/gmetrics/ (Code mesures for CodeNarc)


