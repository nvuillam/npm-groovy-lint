# Changelog

## UNRELEASED

## [14.1.0] 2024-01-15

- fix: missing parse errors with --noserver
- Deactivate log file by default

## [14.0.1] 2023-12-18

- fix: analytics send failure error

## [14.0.0] 2023-12-16

- Fix data race on stdout capture which was corrupting the responses for overlapping requests by using a capturing plugin.
- Fix data race on threads read and write which could result in missed cancellations and re-enable cancellation processing.
- Ensure that threads are always removed in the case of write response exception.
- Switch to jackson to enable efficient JSON encoding and decoding including raw embedding of CodeNarc result to avoid unnecessary processing.
- Split out HTTP filters to their own files.
- Use typed variables instead of def per linter recommendation.
- Add early test for missing base directory to avoid running linter unnecessarily.
- Fix parse failures for files which contain classes that only non-zero argument constructors.
- Add gzip compression to reduce size of network traffic to improve performance
- CI: Enhance MegaLinter config
- CI: Upload expected sources as artifact if Check for changes job fails

## [13.0.2] 2023-12-07

- Remove useless console.log in sources.

## [13.0.1] 2023-12-06

- Update logback to 1.4.14 to address [cve-2023-6378](https://avd.aquasec.com/nvd/2023/cve-2023-6378/)

## [13.0.0] 2023-11-26

- **BREAKING CHANGE: Upgrade CodeNarc to v3.4.0-alpha+3346775f**

- Major core architecture refactoring by the great [**Steven Hartland**](https://github.com/stevenh)

  - Fix files specified on the command line not linting as expected due to the generated patterns not working as intended if relative path that contains a file and not a directory due to an issue with CodeNarc pattern processing.

  - Fix incompatible arguments passed to CodeNarc by:
    - Using arrays internally to avoid issues with spaces in arguments being interpreted incorrectly.
    - Stripping all quotes from string arguments as CodeNarc doesn't handle them correctly.
    - Enable automatic argument quoting on Windows.

  - Fix command line -ext extensions not being processed correctly and matching too many files as it was missing the prefix.

  - Ensure readFile and writeFile calls produce a stack trace on failure due to: https://github.com/nodejs/node/issues/30944.

  - Fix file delete race condition and variable clean up due to missing await.

  - Fix use of includes instead of exclude parameters.

- Also:
  - Fixed Request failed logging
  - Fix README.md typo
  - Add additional useful debug logging
  - Run dev:pre-commit to update CHANGELOG.md
  - Add more cspell entries
  - Add missing items to CodeNarcServer.groovy usage
  - Re-enable tests which are now fixed
  - Override axios for security patch

[Steven Hartland](https://www.linkedin.com/in/steven-hartland-a7435b4/) now becomes an official maintainer of npm-groovy-lint and vscode-groovy-lint !

## [12.2.0] 2023-11-26

- Upgrade java-caller dependency to 3.2.0 (Now handles Mac M1)
- Output issue when error collecting CodeNarc version

## [12.1.2] 2023-11-23

- Revert update that output json when not requested

## [12.1.1] 2023-11-19

- Upgrade node-java-caller to v3.1.1

## [12.1.0] 2023-11-18

- Upgrade node-java-caller to v3.1.0

## [12.0.1] 2023-11-06

- Fix: bump openjdk version from 11 to 17 in Docker image by @SerhiiKorolik in https://github.com/nvuillam/npm-groovy-lint/pull/317

## [12.0.0] 2023-11-04

Many fixes, including an issue with IPV6 that made npm-groovy-lint crash on many machines, has been fixed by @stevenh ! Many thanks to him !

Breaking change: **Minimum java version to Java 17**

* Use MegaLinter v7 by @nvuillam in https://github.com/nvuillam/npm-groovy-lint/pull/254
* Bump json5 from 2.2.1 to 2.2.3 by @dependabot in https://github.com/nvuillam/npm-groovy-lint/pull/260
* ci: fix action failures by @stevenh in https://github.com/nvuillam/npm-groovy-lint/pull/309
* chore: update node to 18 lts by @stevenh in https://github.com/nvuillam/npm-groovy-lint/pull/310
* feat: improve the vscode deployment by @stevenh in https://github.com/nvuillam/npm-groovy-lint/pull/307
* Improve publish via CI + beta when in main by @nvuillam in https://github.com/nvuillam/npm-groovy-lint/pull/311
* chore: improve flow debugging by @stevenh in https://github.com/nvuillam/npm-groovy-lint/pull/303
* ci: predictable server builds and port option by @stevenh in https://github.com/nvuillam/npm-groovy-lint/pull/312
* fix: status bar message by @stevenh in https://github.com/nvuillam/npm-groovy-lint/pull/302
* fix: server and test stability by @stevenh in https://github.com/nvuillam/npm-groovy-lint/pull/313
* fix: UnnecessaryGString for strings with slashes by @stevenh in https://github.com/nvuillam/npm-groovy-lint/pull/304

## [11.1.1] 2022-10-31

- Fix npm dependency minimatch

## [11.1.0] 2022-10-31

- Provide default range when only information available is a line number ([#248](https://github.com/nvuillam/npm-groovy-lint/issues/248))
- New CodeNarc issues definition to calculate range in file
  - GStringExpressionWithinString
  - VariableName

## [11.0.0] 2022-10-07

- **BREAKING CHANGE**:`--failon` is now `ìnfo` by default, meaning exit code will be `1` if there is at least an info issue found. To have previous behaviour, use `--failon none`.
- Display all files in console log only if `--verbose` is used ([#243](https://github.com/nvuillam/npm-groovy-lint/issues/243))

## [10.1.0] 2022-08-15

- Allow to send groovy sources as input from stdin
- If `--format` or `--fix` option is used when source is sent as stdin, the result is output as stdout

Example: `cat path/to/my/Jenkinsfile | npm-groovy-lint --format -`

## [10.0.3] 2022-08-15

- Do not output results summary in console logs when output is json or sarif
- Add test methods for SARIF called by CLI

## [10.0.2] 2022-08-15

- Fix error when absolute files sent as positional arguments on a linux system ([#232](https://github.com/nvuillam/npm-groovy-lint/issues/232))
- Improve performances by calculating the longest command directory to send as base path to CodeNarc

## [10.0.1] 2022-08-14

- Fix error when files sent as positional arguments ([#232](https://github.com/nvuillam/npm-groovy-lint/issues/232))

## [10.0.0] 2022-08-13

- Core
  - Upgrade to [CodeNarc v3.1.0](https://github.com/CodeNarc/CodeNarc/blob/master/CHANGELOG.md#version-310----jun-2022)
  - Accept list of directories / files as arguments (`--path` and `--files` become deprecated but are still usable)
    - Examples
      - Multiple files: `npm-groovy-lint path/to/file1.groovy path/to/file2.groovy`
      - Directory: `npm groovy-lint path/to`
      - Single file: `npm-groovy-lint Jenkinsfile`
      - Ant pattern(s): `npm-groovy-lint path/to/**/*.groovy`
  - Upgrade npm dependencies
  - CI: Upgrade [MegaLinter](https://oxsecurity.github.io/megalinter/latest/) to v6
  - Test classes for collecting error ranges

- New error ranges rules
  - DuplicateNumberLiteral
  - DuplicateStringLiteral
  - MethodParameterTypeRequired
  - NoDef
  - SimpleDateFormatMissingLocale
  - SpaceInsideParenthesis
  - UnnecessaryPublicModifier
  - VariableTypeRequired

- New fix rules
  - SpaceAfterMethodCallName
  - SpaceInsideParentheses

- Bug Fixes
  - Wrongly calculated ranges are no more returned

## [9.5.0] 2022-04-12

- Disable Amplitude anonymous stats by default (use `--insight` to enable them)

## [9.4.1] 2022-01-12

- Upgrade node-sarif-builder to 2.0.1 and send npm-groovy-lint version in SARIF logs
- New range detection for rules:
  - MethodReturnTypeRequired
  - UnusedImport

## [9.4.0] 2022-01-11

- Add [SARIF](https://sarifweb.azurewebsites.net/) output format using [node-sarif-builder](https://github.com/nvuillam/node-sarif-builder)

## [9.3.2] 2022-01-09

- Upgrade cli-progress to avoid [colors lib boring but harmless hack](https://github.com/Marak/colors.js/issues/285)

## [9.3.1] 2022-01-06

- Fix issue when used as module and with file containing spaces ([VsCodeGroovyLint #137](https://github.com/nvuillam/vscode-groovy-lint/issues/137))

## [9.3.0] 2021-12-29

- Upgrade log4j dependencies because of [security issue](https://nvd.nist.gov/vuln/detail/CVE-2021-44832).

## [9.2.0] 2021-12-23

- Upgrade log4j dependencies because of (another) [security issue](https://cve.mitre.org/cgi-bin/cvename.cgi?name=CVE-2021-45105) (#196)

## [9.1.0] 2021-12-14

- Upgrade log4j dependencies because of [security issue](https://unit42.paloaltonetworks.com/apache-log4j-vulnerability-cve-2021-44228/) (#194)

## [9.0.0] 2021-09-30

- Upgrade to [CodeNarc v2.2.0](https://github.com/CodeNarc/CodeNarc/releases/tag/v2.2.0)
- Upgrade to [Groovy v3.0.9](https://groovy-lang.org/)
- Reorganize sources test folder
- Use java from 8 to 14 (install it if a later version is found)
- Add timeouts in CI jobs
- Add colors in error logs

## [8.2.0] 2021-06-11

- Upgrade dependencies advised by dependabot
- Fix Mega-Linter errors found

## [8.1.0] 2020-12-14

- Exclude `UnnecessaryGetter`, `FactoryMethodName`, `MethodReturnTypeRequired`, and `GStringExpressionWithinString` in `recommended-jenkinsfile` ([#140](https://github.com/nvuillam/npm-groovy-lint/pull/140)) ([Felipe Santos](https://github.com/felipecrs))

## [8.0.2] 2020-11-26

- Fix documentation about --verbose and --version options
- Use GitHub action to deploy to NPM

## [8.0.1] 2020-11-19

- Add a test case where variable includes if in its name for fix of rule SpaceAfterIf ([Behlül Uçar](https://github.com/ucarbehlul))

## [8.0.0] 2020-11-15

- Upgrade to CodeNarc 2.0.0
  - Upgrade jars
  - Adapt Indentation rule to new behaviour
  - Use codenarc --ruleset argument instead of temp ruleset file
- Replace super-linter by [Mega-Linter](https://nvuillam.github.io/mega-linter/)
- Fixes
  - [(#127)](https://github.com/nvuillam/npm-groovy-lint/issues/127) Formatting breaks code, converting `else if` into `elseif` in some cases
  - Apply formatting rules also for --fix mode
  - Fix Markdown dead links
- CI
  - Migrate from CircleCI to GitHub Actions: now tests are on Linux, Windows & MacOs
  - Activate spelling linter of Mega-Linter (+ `.cspell.json` file)
  - Add test cases for format and fix using CLI

## [7.6.2] 2020-09-09

- Disable TrailingComma rule by default until crash is solved in [CodeNarc](https://codenarc.github.io/CodeNarc) ([#75@vscode-groovy-lint](https://github.com/nvuillam/vscode-groovy-lint/issues/75))

## [7.6.0] 2020-09-08

- Add GitHub Action [GitHub Super-Linter](https://github.com/marketplace/actions/super-linter) to the repository
- Update Dockerfile to pass Docker lint rules

## [7.5.5] 2020-09-05

- Upgrade [java-caller](https://github.com/nvuillam/node-java-caller) to v2.2.3
  - Fix Java 8 detection ([#101](https://github.com/nvuillam/npm-groovy-lint/issues/101))

## [7.5.4] 2020-09-04

- Update frameworks detection

## [7.5.1] 2020-09-02

- Fix [(#96)](https://github.com/nvuillam/npm-groovy-lint/issues/96) --fix adds redundant space into `${VARIABLE}` (SpaceBeforeOpeningBrace fix rule error)
- Fix grails framework detection
- Fix Groovy parsing parsing when multiple files
- Add `.gvy` and `.nf` in default browsed files extensions

## [7.5.0] 2020-09-02

- Add anonymous framework usage stats for Groovy core Team

## [7.4.3] 2020-08-29

- Upgrade [java-caller](https://github.com/nvuillam/node-java-caller) to v2.2.0
  - Fix CLASSPATH on windows in case there are spaces in paths

## [7.4.2] 2020-08-26

- Fix [(#90)](https://github.com/nvuillam/npm-groovy-lint/issues/90) When log level is specified number of linted files appear to be off

## [7.4.1] 2020-08-23

- [(#88)](https://github.com/nvuillam/npm-groovy-lint/pull/88) Fix Docker image to allow to use extra parameters (by [Howard Lo](https://github.com/warhod))

## [7.4.0] 2020-08-17

- [(#87)](https://github.com/nvuillam/npm-groovy-lint/pull/87) update to openjdk 11 in [official Docker image](https://hub.docker.com/r/nvuillam/npm-groovy-lint) (by [Pawel Kopka](https://github.com/pawelkopka))

## [7.3.1] 2020-08-16

- Add number of lines & reorganize anonymous statistics
- Fix error type counters in anonymous statistics

## [7.3.0] 2020-08-15

- Allow to link to [CodeNarc RuleSet files](https://codenarc.github.io/CodeNarc/codenarc-creating-ruleset.html) from `.groovylintrc.json`, using property `"codenarcRulesets"`. Warning: doing so means that all other properties of config file will be ignored.

## [7.1.1] 2020-08-11

- Upgrade [java-caller](https://www.npmjs.com/package/java-caller) to v2.0.0

## [7.1.0] 2020-08-10

- Externalize JavaCaller class into a separate package [java-caller](https://www.npmjs.com/package/java-caller) and use it

## [7.0.0] 2020-08-07

- New default recommended rules (activate/deactivate/change severity)
- Allow to call `--config recommended-jenkinsfile` to use delivered .groovylintrc-recommended-jenkinsfile.json

## [6.1.1] 2020-08-04

- Fix SpaceAfterComma auto-fixing rule

## [6.1.0] 2020-08-04

- Java 14 compatibility (Closes [#77](https://github.com/nvuillam/npm-groovy-lint/issues/7))

## [6.0.0] 2020-08-03

- Upgrade to [CodeNarc v1.6.1](https://github.com/CodeNarc/CodeNarc/blob/v1.6-patch-releases/CHANGELOG.md#version-161----aug-2020)
  - Update list of rules
  - Use new CodeNarc JSON console Output instead of temporary XML files
  - Call CodeNarc to get its version instead of using npm-groovy-lint hardcoded value
- Upgrade to [GMetrics v1.1](https://github.com/dx42/gmetrics/blob/master/CHANGELOG.md#version-11-may-2020)
- Upgrade to [Groovy v3.0.5](https://groovy-lang.org/)
- Add anonymous usage stats on types of errors found and fixed

## [5.8.0] 2020-08-01

- Fix & enhance anonymous statistics

## [5.7.0] 2020-07-23

- [(#62)](https://github.com/nvuillam/npm-groovy-lint/pull/74) Check parse error in all files when called via CLI . Closes [#69](https://github.com/nvuillam/npm-groovy-lint/issues/69)

## [5.6.1] 2020-07-20

Fixes:

- [(#62)](https://github.com/nvuillam/npm-groovy-lint/issues/62) using a codenarc ruleset file seems to fail / groovylintrc is not codenarc compatible

## [5.6.0] 2020-07-20

- [(#68)](https://github.com/nvuillam/npm-groovy-lint/pull/68) Generate a [ready-to-use docker image](https://hub.docker.com/r/nvuillam/npm-groovy-lint) when publishing new npm-groovy-lint version (by [Dave Gallant](https://github.com/davegallant))

## [5.5.1] 2020-07-15

- Fixes
  - [(#64)](https://github.com/nvuillam/vscode-groovy-lint/issues/64) The contents of a string gets formatted unexpectedly

## [5.5.0] 2020-07-09

- Allow to override java executable and options [(#54)](https://github.com/nvuillam/vscode-groovy-lint/issues/54)

## [5.4.2] 2020-07-09

- Use os.EOL [(#65)](https://github.com/nvuillam/npm-groovy-lint/pull/65) solving  [(#63)](https://github.com/nvuillam/npm-groovy-lint/issues/63) --fix for indentation adds CRLF line-endings to all files it touches

## [5.4.1] 2020-07-01

- CodeNarcServer listens to localhost only [(#59)](https://github.com/nvuillam/npm-groovy-lint/pull/59) solving [(#56)](https://github.com/nvuillam/npm-groovy-lint/issues/56)
- Replace @analytics/segment with @amplitude/node for anonymous stats

## [5.3.0] 2020-06-29

- New option **--failon** , replacing `--failonerror`,`--failonwarning` and `--failoninfo`. It can take error, warning or info values (default: none). Previous options remain working but are deprecated and will be removed in a future major version
- Update help for `--fixrules` option

## [5.1.0] 2020-06-04

- Install Java 8 using node-jre in case java version found is higher than Java 11 (CodeNarc compatibility is Java 8 to 11)

## [5.0.3] 2020-05-30

- Updated fix rules
  - Indentation
  - IndentationClosingBrace

## [5.0.2] 2020-05-27

- Avoid to apply wrong fix in case of CodeNarc false positive
- New fix rules
  - BlankLineBeforePackage
- Updated fix rules
  - BracesForIfElse
  - BracesForMethod
  - BracesForTryCatchFinally
  - ClassEndsWithBlankLine
  - ClassStartsWithBlankLine
  - MissingBlankLineAfterImports
  - MissingBlankLineAfterPackage
  - UnnecessaryGroovyImport
  - UnusedImport

## [5.0.0] 2020-05-25

- **BIG BANG**: Improve performances, compatibility, architecture and delivery
  - Get rid of [jDeploy](https://github.com/shannah/jdeploy) dependency
    - Use own **java-caller.js** for java commands
    - Update CircleCI config to use `npm link`instead of `jdeploy install`
  - Get rid of [request](https://github.com/request/request) dependency
    - Use [axios](https://github.com/axios/axios) for promisified http calls

## [4.14.0] 2020-05-22

- Send rule configuration to fix functions
- Add `.gradle` files in default linted files
- Fixes:
  - Missing number of linted files returned in summary
  - Try to call CodeNarcJava in case there is an error with CodeNarcServer call

## [4.13.0] 2020-05-20

- Manage to send options for rules sent in `rulesets`: Ex: `Indentation{"spacesPerIndentLevel":2,"severity":"warning"},UnnecessarySemicolon`
- New parameter `--rulesetsoverridetype` : If list of rules sent in rulesets option, defines if they replace rules defined in .groovylintrc.json, or if they are appended

## [4.12.0] 2020-05-18

- Improve performances and avoid `Unknown command: node` error by using childProcess.fork to call CodeNarcServer

## [4.11.1] 2020-05-16

- Detect when crash is related to "node" or "java" command not found and return a human readable error message

## [4.11.0] 2020-05-13

- Add CI , rule overrides and crashes in anonymous insights for debugging investigation
- When used as a module, **never crash intentionally with throw**, so when called by module, check linter.status and linter.error instead of try/catch
  - 0: ok
  - 1: expected error
  - 2: unexpected error
  - 9: if cancelled request

## [4.10.0] 2020-05-12

- Update analytics to use [analytics](https://www.npmjs.com/package/analytics) & [@analytics-segment](https://github.com/DavidWells/analytics/tree/master/packages/analytics-plugin-segment) instead of [insight](https://www.npmjs.com/package/insight). If you want to disable anonymous usage stats, you can still use `--no-insight` option.

## [4.9.0] 2020-05-10

- Add anonymous usage statistics using [insight](https://www.npmjs.com/package/insight), in order to make new improvements based on how users use this package.
  - Note: Analytics obviously does not receive sensitive information like your code, as you can see in [analytics.js](https://github.com/nvuillam/npm-groovy-lint/blob/master/lib/analytics.js). If you want to disable anonymous usage stats, use `--no-insight` option.

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

- Upgrade to [Groovy 3.0.3](https://groovy.jfrog.io/ui/native/dist-release-local/groovy-zips/apache-groovy-binary-3.0.3.zip)
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
