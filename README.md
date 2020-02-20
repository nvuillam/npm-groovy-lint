# NPM GROOVY LINT (and FIX !)

[![Version](https://img.shields.io/npm/v/npm-groovy-lint.svg)](https://npmjs.org/package/npm-groovy-lint)
[![Downloads/week](https://img.shields.io/npm/dw/npm-groovy-lint.svg)](https://npmjs.org/package/npm-groovy-lint) 
[![CircleCI](https://circleci.com/gh/nvuillam/npm-groovy-lint/tree/master.svg?style=shield)](https://circleci.com/gh/nvuillam/npm-groovy-lint/tree/master)
[![codecov](https://codecov.io/gh/nvuillam/npm-groovy-lint/branch/master/graph/badge.svg)](https://codecov.io/gh/nvuillam/npm-groovy-lint)
[![GitHub contributors](https://img.shields.io/github/contributors/nvuillam/npm-groovy-lint.svg)](https://gitHub.com/nvuillam/npm-groovy-lint/graphs/contributors/)
[![GitHub stars](https://img.shields.io/github/stars/nvuillam/npm-groovy-lint?style=social&label=Star&maxAge=2592000)](https://GitHub.com/nvuillam/npm-groovy-lint/stargazers/)
[![License](https://img.shields.io/npm/l/npm-groovy-lint.svg)](https://github.com/nvuillam/npm-groovy-lint/blob/master/package.json) 
[![HitCount](https://hits.dwyl.com/nvuillam/npm-groovy-lint.svg)](https://hits.dwyl.com/nvuillam/npm-groovy-lint)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](http://makeapullrequest.com)
[![Say Thanks!](https://img.shields.io/badge/Say%20Thanks-!-1EAEDB.svg)](https://saythanks.io/to/nicolas.vuillamy@gmail.com)

**Groovy / Jenkinsfile linter and fixer**

 Based on [CodeNarc](http://codenarc.sourceforge.net/) , this out of the box package allows to easily find errors and correct a part of them

Easy to integrate in a CD/CI process (Jenkins Pipeline,CircleCI...) to lint your groovy or Jenkinsfile :)

Use option **--fix** to activate auto-correction

# INSTALLATION

```
    $ npm install -g npm-groovy-lint
```

For advanced usage,  you may need to define [RuleSet file(s)](http://codenarc.sourceforge.net/codenarc-creating-rule.html)

You can use as starters :

- [All rules](https://github.com/nvuillam/npm-groovy-lint/blob/master/lib/example/RuleSet-All.groovy)
- [Base rules](https://github.com/nvuillam/npm-groovy-lint/blob/master/lib/example/RuleSet-Groovy.groovy)

# USAGE

```
    $ npm-groovy-lint OPTIONS
```

## npm-groovy-lint OPTIONS



See OPTIONS in [CodeNarc documentation](http://codenarc.sourceforge.net/codenarc-command-line.html)

# EXAMPLES

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


