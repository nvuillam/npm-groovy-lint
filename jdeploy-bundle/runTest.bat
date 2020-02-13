REM cmd /c java -classpath lib/groovy-3.0.0/lib/groovy-3.0.0.jar;lib/CodeNarc-1.4.jar;lib/slf4j-api-1.7.9.jar org.codenarc.CodeNarc -help

REM cmd /c java -classpath lib/groovy-3.0.0/lib/groovy-3.0.0.jar;lib/groovy-3.0.0/lib/groovy-templates-3.0.0.jar;lib/groovy-3.0.0/lib/groovy-xml-3.0.0.jar;lib/CodeNarc-1.4.jar;lib/slf4j-api-1.7.9.jar;lib/log4j-slf4j-impl-2.13.0.jar;lib/log4j-api-2.13.0.jar;lib/log4j-core-2.13.0.jar;lib/GMetrics-0.7.jar;lib org.codenarc.CodeNarc -basedir=C:/Work/git/DXCO4SF_Sources_OEM -rulesetfiles="file:RuleSet-all.txt" -title="DXCO4SF_Sources_OEM" -maxPriority1Violations=0 -report="html:ReportDXCO4SF_Sources_OEM.html"

cmd /c java -classpath lib/CodeNarc-1.4-patched.jar;lib/groovy-3.0.0/lib/groovy-3.0.0.jar;lib/groovy-3.0.0/lib/groovy-templates-3.0.0.jar;lib/groovy-3.0.0/lib/groovy-xml-3.0.0.jar;lib/slf4j-api-1.7.9.jar;lib/log4j-slf4j-impl-2.13.0.jar;lib/log4j-api-2.13.0.jar;lib/log4j-core-2.13.0.jar;lib/GMetrics-0.7.jar;lib org.codenarc.CodeNarc -basedir=test -rulesetfiles="file:RuleSet-all.txt" -title="Test" -maxPriority1Violations=0 -report="html:ReportTest.html"

pause