// More info there : http://codenarc.github.io/CodeNarc/codenarc-creating-ruleset.html

ruleset {
  ruleset('rulesets/basic.xml') {}
  ruleset('rulesets/braces.xml') {}
  ruleset('rulesets/comments.xml') {
    ClassJavadoc(enabled: false)
  }
  ruleset('rulesets/convention.xml') {
    CompileStatic(enabled: false)
    FieldTypeRequired(enabled: false)
    MethodReturnTypeRequired(enabled: false)
    NoDef(enabled: false)
    TrailingComma (enabled: false)
    VariableTypeRequired(enabled: false)
  }
  ruleset('rulesets/design.xml') {
    Instanceof(enabled: false)
    SimpleDateFormatMissingLocale(enabled: false)
  }
  ruleset('rulesets/exceptions.xml') {}
  ruleset('rulesets/formatting.xml') {
    BlockStartsWithBlankLine(enabled: false)
    Indentation(spacesPerIndentLevel: 4)
    LineLength(length: 200)
    SpaceAroundMapEntryColon(enabled:false)
    SpaceBeforeClosingBrace(ignoreEmptyBlock: true)
  }
  ruleset('rulesets/generic.xml') {}
  ruleset('rulesets/groovyism.xml') {
    ExplicitCallToEqualsMethod(enabled: false)
  }
  ruleset('rulesets/imports.xml') {}
  ruleset('rulesets/naming.xml') {
    FactoryMethodName(enabled: false)
    VariableName(ignoreVariableNames: '_')
  }
  ruleset('rulesets/security.xml') {}
  ruleset('rulesets/size.xml') {
    AbcMetric(enabled: false)
    CyclomaticComplexity(enabled: false)
    NestedBlockDepth(maxNestedBlockDepth: 8)
  }
  ruleset('rulesets/unnecessary.xml') {
    UnnecessaryPublicModifier(enabled: false)
    UnnecessaryReturnKeyword(enabled: false)
  }
  ruleset('rulesets/unused.xml') {
    UnusedVariable(ignoreVariableNames: '_')
  } 
}