// More info there : http://codenarc.sourceforge.net/codenarc-creating-ruleset.html

ruleset {
  ruleset('rulesets/basic.xml') {}
  ruleset('rulesets/braces.xml') {}
  ruleset('rulesets/comments.xml') {
    ClassJavadoc(enabled: false)
  }
  ruleset('rulesets/convention.xml') {
    CompileStatic(enabled: false)
    NoDef(enabled: false)
    VariableTypeRequired(enabled: false)
  }
  ruleset('rulesets/design.xml') {
    BuilderMethodWithSideEffects(enabled: false)
    Instanceof(enabled: false)
  }
  ruleset('rulesets/exceptions.xml') {}
  ruleset('rulesets/formatting.xml') {
    Indentation(spacesPerIndentLevel: 4, enabled: false)
    LineLength(length: 200)
    SpaceAroundMapEntryColon(characterAfterColonRegex: /\s/)
    SpaceBeforeClosingBrace(ignoreEmptyBlock: true)
    TrailingWhitespace(enabled:false)
  }
  ruleset('rulesets/generic.xml') {}
  ruleset('rulesets/groovyism.xml') {}
  ruleset('rulesets/imports.xml') {
    UnusedImport(enabled:false)
  }
  ruleset('rulesets/naming.xml') {
    FactoryMethodName(enabled: false)
    VariableName(ignoreVariableNames: '_')
  }
  ruleset('rulesets/security.xml') {}
  ruleset('rulesets/size.xml') {
    NestedBlockDepth(maxNestedBlockDepth: 8)
  }
  ruleset('rulesets/unnecessary.xml') {
    UnnecessaryReturnKeyword(enabled: false)
  }
  ruleset('rulesets/unused.xml') {
    UnusedVariable(ignoreVariableNames: '_')
  } 
}