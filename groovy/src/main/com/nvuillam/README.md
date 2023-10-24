# CodeNarcServer

The server is a simple groovy wrapper to [CodeNarc](https://github.com/CodeNarc/CodeNarc)
which provides both direct access and server (web requests).

## Usage

```text
usage: groovy CodeNarcServer.groovy [--help] [--server] [--port <port>]
 -b,--verbose      Enables verbose output
 -h,--help         Show usage information
 -p,--port <port>  Sets the server port (default: 7484)
 -s,--server       Runs CodeNarc as a server (default: run CodeNarc directly)
 -v,--version      Outputs the version of CodeNarc
 ```

To see this in action from the root of this repository:

```shell
groovy -cp "lib/java/*" groovy/src/main/com/nvuillam/CodeNarcServer.groovy --server
```

Any arguments not defined above are passed through to CodeNarc, which currently
supports the following syntax:

```text
CodeNarc - static analysis for Groovy,
Usage: java org.codenarc.CodeNarc [OPTIONS]
  where OPTIONS are zero or more command-line options of the form "-NAME[=VALUE]":
    -basedir=<DIR>
        The base (root) directory for the source code to be analyzed.
        Defaults to the current directory (".").
    -includes=<PATTERNS>
        The comma-separated list of Ant-style file patterns specifying files that must
        be included. Defaults to "**/*.groovy".
    -excludes=<PATTERNS>
        The comma-separated list of Ant-style file patterns specifying files that must
        be excluded. No files are excluded when omitted.
    -rulesetfiles=<FILENAMES>
        The path to the Groovy or XML RuleSet definition files, relative to the classpath.
        This can be a single file path, or multiple paths separated by commas. Each path may be optionally prefixed by
        any of the valid java.net.URL prefixes, such as "file:" (to load from a relative or absolute filesystem path),
        or "http:". If it is a URL, its path may be optionally URL-encoded. That can be useful if the path contains
        any problematic characters, such as comma (',') or hash ('#'). For instance:
            file:src/test/resources/RuleSet-,#.txt
        can be encoded as:
            file:src%2Ftest%2Fresources%2FRuleSet-%2C%23.txt
        See URLEncoder#encode(java.lang.String, java.lang.String). Defaults to "rulesets/basic.xml"
    -ruleset=JSON_STRING
        String containing a ruleSet in JSON format (if set, rulesetfiles argument will be ignored)
        The JSON string must be URL-encoded in UTF-8 before being sent as argument to CodeNarc
    -excludeBaseline=<FILENAME>
        The filename of the optional baseline. If not set, no baseline will be used.
    -maxPriority1Violations=<MAX>
        The maximum number of priority 1 violations allowed (int).
    -maxPriority2Violations=<MAX>
        The maximum number of priority 2 violations allowed (int).
    -maxPriority3Violations=<MAX>
        The maximum number of priority 3 violations allowed (int).
    -failOnError=true/false
        Whether to terminate and fail the task if any errors occur parsing source files (true), or just log the errors (false). It defaults to false.
    -title=<REPORT TITLE>
        The title for this analysis; used in the output report(s), if supported by the report type. Optional.
    -report=<REPORT-TYPE[:FILENAME|:stdout]>
        The definition of the report to produce. The option value is of the form
        TYPE[:FILENAME], where TYPE is "html", "text", "xml", or "console" and FILENAME is the filename (with
        optional path) of the output report filename. If the TYPE is followed by :stdout (e.g. "html:stdout", "json:stdout"),
        then the report is written to standard out. If the report filename is  omitted, the default filename
        is used for the specified report type ("CodeNarcReport.html" for "html", "CodeNarcXmlReport.xml" for
        "xml" and "CodeNarcJsonReport.json" for "json"). If no report option is specified, default to a
        single "html" report with the default filename.
    -plugins=<PLUGIN CLASS NAMES>
        The optional list of CodeNarcPlugin class names to register, separated by commas.
    -help
        Display the command-line help. If present, this must be the only command-line parameter.
  Example command-line invocations:
    java org.codenarc.CodeNarc
    java org.codenarc.CodeNarc -rulesetfiles="rulesets/basic.xml" title="My Project"
    java org.codenarc.CodeNarc -rulesetfiles="rulesets/basic.xml" -report=baseline:codenarc-baseline.xml
    java org.codenarc.CodeNarc -rulesetfiles="rulesets/basic.xml" -excludeBaseline=file:codenarc-baseline.xml
    java org.codenarc.CodeNarc -report=xml:MyXmlReport.xml -report=html
    java org.codenarc.CodeNarc -report=json:stdout
    java org.codenarc.CodeNarc -help'
```


## Logging

The defaults for logging are detailed in [simplelooger.properties](/simplelogger.properties).

You can also override the defaults using system properties, for example to enable
debug add the following to the command line:

```shell
-Dorg.slf4j.simpleLogger.defaultLogLevel=DEBUG
```
