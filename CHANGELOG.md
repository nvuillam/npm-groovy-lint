# Changelog

## [3.1.2] 2020-03-22

### Added

- Fix rules:
  - BlockEndsWithBlankLine
  - BlockStartsWithBlankLine
  - MisorderedStaticImports
  - SpaceAfterIf

### Changed

- Fix: Update correctly the lineNb & ranges of next errors after an error has been fixed
- Do not return rules tests if call is not from a test file
- Fix rules:
  - ElseBlockBraces
  - IfStatementBraces
  - SpaceAroundOperator
  - UnusedImport

## [3.1.1] 2020-03-20

### Added

- Fix rules:
  - BlockEndsWithBlankLine
  - BlockStartsWithBlankLine
  - MisorderedStaticImports
  - SpaceAfterIf

### Changed

- Fix rules:
  - SpaceAroundOperator

## [3.1.0] 2020-03-18

### Changed

- Test suites: Improve reliability & logs for rule fixes tests (detected numerous bugs, now corrected)
- Send computed range to fix functions
- Fix rules:
  - ClosingBraceNotAlone
  - ElseBlockBraces
  - IfStatementBraces
  - NoTabCharacter
  - SpaceAfterComma
  - SystemExit
  - TrailingWhitespace
  - UnnecessaryGroovyImport
  - UnusedImport

## [3.0.1] 2020-03-17

### Added

- Add new test suites: errors.test.js and miscellaneous.test.js

### Changed

- Use JSON as default GroovyLint configuration file type
- Order of fixable rules must be defined in groovy-lint-rules.js
- Do not load rules test data except during tests
- Do not lint again after a call to fixErrors on an existing NpmGroovyLint instance (except if lintAgainAfterFix : true is sent in options)
- Fix: Deletion of temp RuleSite file
- Fix: UnnecessarySemiColon rule
- Fix: ClosingBraceNotAlone rule

## [3.0.0] 2020-03-15

### Added 

- Local microservice "CodeNarcServer" called via Http by npm-groovy-lint, to avoid loading all groovy/java classes at each lint request. This microservice autokills itself after one hour idle.
- Capability to define RuleSets in argument or js/json/yml config file formats instead of groovy/xml RuleSet format
- Test classes for rules fix (before / after fix defined in rule definitions)
- Add debug logs (use it by setting DEBUG env variable , ex: `DEBUG=npm-groovy-lint npm-groovy-lint args...`)
- Update lines and ranges of other errors after a fix updated the number of lines
- Generate automatically .groovylintrc-all.js during build 

## Changed

- Split rules definition into files instead of all in a huge single file
- Reorganise groovy-lint.js code, using codenarc-factory.js and codenarc-caller.js
- New lib utils.js that can be used by rules definition
- Fix: Crash when there was no error found in a file
- Fix: Remove Promise error display in log after launching CodeNarcServer
- Fix: Add more options exclusivity arguments rules
- Removed "Groovy", "Jenkinsfile" and "All" identifiers for --rulesets arguments. Please now use .groovylintrc.js configuration

## [2.2.0] 2020-02-28

### Added

- Capability to call NpmGroovyLint with options as object, not only command line arguments
- New option "source", allowing to call NpmGroovyLint with the groovy code as a string , not only path & files pattern
- Run lint again after fix all errors, to get updated lintResult
- Add gitattributes to normalized line-endings (thanks [docwhat](https://github.com/docwhat))
- API: fix only some errors after an initial lint (better perfs)
- Return error range in files for some rules in JSON or API result (will be useful for the VsCode extension currently developed)
- Define range function for existing rules, new fixable rules

## [2.0.1] - 2020-02-21

### Added

- Capability to fix errors
    - ConsecutiveBlankLines
    - Indentation (IfStatementBraces and ElsefStatementBraces must be manually fixed to have correct indentation)
    - IndentationComments (custom npm-groovy-rule triggered by Identation rule)
    - IdentationClosingBrace (custom npm-groovy-rule triggered by Identation rule)
    - NoTabCharacter
    - SpaceAfterCatch
    - SpaceAfterOpeningBrace
    - SpaceAroundOperator
    - SpaceAfterComma
    - SpaceBeforeOpeningBrace
    - UnnecessaryDefInFieldDeclaration
    - UnnecessaryGString
    - UnnecessaryPublicModifier
    - UnnecessarySemicolon
    - TrailingWhitespace
- Log formatting with severity colors and summary table
- Defaut recommended RuleSets for Groovy and Jenkins
- Progress bar in console
- More code coverage with test campaigns
- Capability to call NpmGrooyLint from another package (VsCode extension development in progress ^^)

### Changed

- Refactored command line arguments ( simpler, but different from CodeNarc ones : retro-compatibility with CodeNarc arguments assured if you add --codenarcargs)
- Upgrade to CodeNarc v1.5
- Upgrade to Groovy v3.0.1
- Refactored documentation with detailed arguments description & examples

# Removed

- CodeNarc original format of command line arguments

___
## Before

 - I wasn't serious enough to keep a changelog, sorry !








