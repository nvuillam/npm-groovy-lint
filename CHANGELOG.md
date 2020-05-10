# Changelog

## [4.9.0] 2020-05-10

- Add anonymous usage statistics using [insight](https://www.npmjs.com/package/insight), in order to make new improvements based on how users use this package. Analytics obviously does not receive sensitive information like your code, as you can see in [analytics.js](https://github.com/nvuillam/npm-groovy-lint/blob/master/src/analytics.js). If you want to disable anonymous usage stats, use `--no-insight` option.

## [4.8.0] 2020-05-08

- New fix rules
  - AssignmentInConditional
  - DuplicateImport
  - ExplicitLinkedListInstantiation
  - InsecureRandom
  - UnnecessaryDefInVariableDeclaration
  - UnnecessaryDotClass
  - UnnecessaryFinalOnPrivateMethod
  - UnnecessaryInstantiationToGetClass

- Updated fix rules
  - BracesForForLoop: False positive triggering messy code after fixing
  - UnnecessaryGString: Fix multiline replacements ( `"""` by `'''` )

- Fixes :
  - Launch JVM with high memory (`-Xms256m -Xmx2048m`) to improve performances on big files
  - Increase CodeNarcServ call timeout (+ Manage ETIMEOUT as result, not only ECONNREFUSED )

- Utils
  - Allow regex in range functions

## [4.7.0] 2020-05-06

- New fix rules
  - BracesForClass
  - BracesForForLoop
  - BracesForIfElse
  - BracesForMethod
  - BracesForTryCatchFinally
  - ExplicitArrayListInstantiation
  - MissingBlankLineAfterImports
  - MissingBlankLineAfterPackage

- Updated fix rules
  - UnnecessaryGString: Fix replacements containing `\n` and `\r`

## [4.6.0] 2020-05-01

- New fix rules
  - SpaceBeforeClosingBrace
  - UnnecessaryDefInMethodDeclaration
  - UnnecessaryPackageReference
  - UnnecessaryParenthesesForMethodCallWithClosure

- Updated fix rules
  - MisorderedStaticImports: Fix `@Grapes` killer fixing rule
  - ElseBlockBrace :issue when instruction is on the same line than `else`

## [4.5.5] 2020-04-30

- Fixes
  - ignorepattern option not working [#34](https://github.com/nvuillam/npm-groovy-lint/issues/34)

## [4.5.2] 2020-04-29

- Expose `loadConfig()` method to load rules when npm-groovy-lint is used as a library
- Fixes
  - Missing temporary rulesets file missing
  - Handle better CodeNarcServer concurrent calls

## [4.5.1] 2020-04-28

- Fixes
  - Take in account user overridden indentation space (and other rules) when using --format option [#31](https://github.com/nvuillam/npm-groovy-lint/issues/31)

## [4.5.0] 2020-04-24

- Configuration updates ([#29](https://github.com/nvuillam/npm-groovy-lint/issues/29)):
  - New default config "recommended-jenkinsfile". Use it with argument `--config recommended-jenkinsfile`
  - Allow to directly target a config file name. Use it with argument `--config /my/custom/path/.groovylintrc-custom-name.json`
  - Allow to send a string key that will be used to find config file `--config custom-name`
- Updated fix rules:
  - IfStatementBraces
  - ElseStatementBraces

## [4.4.1] 2020-04-16

- Fixes:
  - CodeNarcServer: Use cachedThreadPool instead of fixedThreadPool

## [4.4.0] 2020-04-16

- Cancel a CodeNarc Lint when a similar CodeNarcServer request is received (allowing onType mode for language servers)

## [4.3.0] 2020-04-14

- Allow to disable rules using comments in source in [eslint style](https://eslint.org/docs/user-guide/configuring#disabling-rules-with-inline-comments)

## [4.2.0] 2020-04-13

- New option **--parse**: Capability to parse source code and return compilation errors
- New fix rules (thanks [CatSue](https://github.com/CatSue) !):
  - SpaceAfterSemicolon
  - SpaceAfterWhile

## [4.1.0] 2020-04-12

- Upgrade to [Groovy 3.0.3](https://dl.bintray.com/groovy/maven/apache-groovy-binary-3.0.3.zip)
- Automatic generation of fixable rules list for README
- Refactor CodeNarcServer.groovy

## [4.0.0] 2020-04-09

- Fix [issue](https://github.com/nvuillam/vscode-groovy-lint/issues/16) affecting performances on Linux and MacOs

## [3.3.0] 2020-04-06

- When formatting, always run some custom npm-groovy-lint fix rules not corresponding to CodeNarc violations
- Return CodeNarc and Groovy versions when --version options is called
- Fixes
  - Lost indentation when applying some fix rules
- Updated fix rules:
  - IndentationClosingBraces
  - IndentationComments
  - SpaceAfterCatch
  - SpaceAfterIf
- New fix rules:
  - ClassEndsWithBlankLine
  - ClassStartsWithNewLine
  - SpaceAfterFor
  - SpaceAfterSwitch

## [3.2.4] 2020-04-03

- Error message in postinstall if env Node.js is lower than the minimal required (12)

## [3.2.3] 2020-04-02

- When If or Else brackets are fixed,trigger another rule lint & fix only with Indentation rules so CodeNarc recalculate them correctly
- New option `nolintafter`: When format or fix is called, a new lint is performed after the fixes to update the error list. If you just want the updated source code and do not care about the error logs, use this parameter to improve performances
- Fixes
  - Manage correctly options `failonerror`, `failonwarning` and `failoninfo`
  - `npm-groovy-lint -version` now returns version from package.json
- Mocha tests updates:
  - Add stats on calls to CodeNarc (`globalThis.codeNarcCallsCounter` and `globalThis.codeNarcCalls`, activated if `globalThis.codeNarcCallsCounter` is set to 0 before calling NmpGroovyLint)
  - Factorize test classes common code in module helper/common.js
  - Use a smaller groovy file for test classes when not impacting the tests quality

## [3.2.2] 2020-03-31

- New option **returnrules** if you want to return rules descriptions and documentation url in results
- Use npm ci instead of npm install in CircleCI build

## [3.2.1] 2020-03-29

- Return rules descriptions in results
- New option **nolintafter**: do not lint again a format or a fix, as the client prefers to request it
- Fixes
  - [Issue #13](https://github.com/nvuillam/npm-groovy-lint/issues/13): False positive error ClassNameSameAsFileName
  - Sometimes returning wrong .groovylint.json config file

## [3.2.0] 2020-03-26

- New option "--format", allowing to reformat source code (using .groovylintrc-format.json)
- Update default recommended rules

## [3.1.3] 2020-03-22

- README: Link to [Visual Studio Code Groovy Lint extension](https://marketplace.visualstudio.com/items?itemName=NicolasVuillamy.vscode-groovy-lint)

## [3.1.2] 2020-03-22

- New Fix rules:
  - BlockEndsWithBlankLine
  - BlockStartsWithBlankLine
  - MisorderedStaticImports
  - SpaceAfterIf
- Fix: Update correctly the lineNb & ranges of next errors after an error has been fixed
- Do not return rules tests if call is not from a test file
- Fix rules:
  - ElseBlockBraces
  - IfStatementBraces
  - SpaceAroundOperator
  - UnusedImport

## [3.1.1] 2020-03-20

- New Fix rules:
  - BlockEndsWithBlankLine
  - BlockStartsWithBlankLine
  - MisorderedStaticImports
  - SpaceAfterIf
- Updated Fix rules:
  - SpaceAroundOperator

## [3.1.0] 2020-03-18

- Test suites: Improve reliability & logs for rule fixes tests (detected numerous bugs, now corrected)
- Send computed range to fix functions
- Updated Fix rules:
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

- Add new test suites: errors.test.js and miscellaneous.test.js
- Use JSON as default GroovyLint configuration file type
- Order of fixable rules must be defined in groovy-lint-rules.js
- Do not load rules test data except during tests
- Do not lint again after a call to fixErrors on an existing NpmGroovyLint instance (except if lintAgainAfterFix : true is sent in options)
- Fix: Deletion of temp RuleSite file
- Fix: UnnecessarySemiColon rule
- Fix: ClosingBraceNotAlone rule

## [3.0.0] 2020-03-15

- Local microservice "CodeNarcServer" called via Http by npm-groovy-lint, to avoid loading all groovy/java classes at each lint request. This microservice auto-kills itself after one hour idle.
- Capability to define RuleSets in argument or js/json/yml config file formats instead of groovy/xml RuleSet format
- Test classes for rules fix (before / after fix defined in rule definitions)
- Add debug logs (use it by setting DEBUG env variable , ex: `DEBUG=npm-groovy-lint npm-groovy-lint args...`)
- Update lines and ranges of other errors after a fix updated the number of lines
- Generate automatically .groovylintrc-all.js during build
- Split rules definition into files instead of all in a huge single file
- Reorganize groovy-lint.js code, using codenarc-factory.js and codenarc-caller.js
- New lib utils.js that can be used by rules definition
- Fix: Crash when there was no error found in a file
- Fix: Remove Promise error display in log after launching CodeNarcServer
- Fix: Add more options exclusivity arguments rules
- Removed "Groovy", "Jenkinsfile" and "All" identifiers for --rulesets arguments. Please now use .groovylintrc.js configuration

## [2.2.0] 2020-02-28

- Capability to call NpmGroovyLint with options as object, not only command line arguments
- New option "source", allowing to call NpmGroovyLint with the groovy code as a string , not only path & files pattern
- Run lint again after fix all errors, to get updated lintResult
- Add gitattributes to normalized line-endings (thanks [docwhat](https://github.com/docwhat))
- API: fix only some errors after an initial lint (better performances)
- Return error range in files for some rules in JSON or API result (will be useful for the VsCode extension currently developed)
- Define range function for existing rules, new fixable rules

## [2.0.1] - 2020-02-21

- Capability to fix errors
  - ConsecutiveBlankLines
    - Indentation (IfStatementBraces and ElseIfStatementBraces must be manually fixed to have correct indentation)
    - IndentationComments (custom npm-groovy-rule triggered by Indentation rule)
    - IndentationClosingBrace (custom npm-groovy-rule triggered by Indentation rule)
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
- Default recommended RuleSets for Groovy and Jenkins
- Progress bar in console
- More code coverage with test campaigns
- New Capability to call NpmGroovyLint from another package (VsCode extension development in progress ^^)
- Refactored command line arguments ( simpler, but different from CodeNarc ones : retro-compatibility with CodeNarc arguments assured if you add --codenarcargs)
- Upgrade to CodeNarc v1.5
- Upgrade to Groovy v3.0.1
- Refactored documentation with detailed arguments description & examples

___

## Before

- I wasn't serious enough to keep a changelog, sorry !
