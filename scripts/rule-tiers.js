// Source of truth for the rule tiers shipped as .groovylintrc-<name>.json presets.
//
// The selection criterion, borrowed from eslint:recommended:
//
//   A rule belongs to `recommended` when a violation is most likely a *mistake* - code that does
//   not do what its author meant, that is dead or unreachable, that is a security or concurrency
//   hazard, or that misuses a well-known API. A rule that expresses a preference between two
//   correct ways of writing the same thing belongs to `advanced`.
//
// Cost is deliberately not a criterion. `recommended` is a statement about which rules earn a
// place in everyone's default run, not about which rules are cheap.
//
// Layout is not in `recommended` at all: it belongs to the `format` preset, which `--format` and
// `--fix` apply on top of the lint ruleset, so `npm-groovy-lint --fix` still repairs layout.
//
// Semantics of the table below, per category:
//   - a tier key listed with an explicit array picks exactly those rules;
//   - the REST sentinel takes every rule of the category not picked by another tier;
//   - a category with no REST entry must enumerate all of its rules, or the build fails;
//   - a category missing from the table fails the build, so a new CodeNarc category has to be
//     triaged rather than silently joining a preset.
//
// Tiers:
//   recommended - the default preset (likely problems)
//   advanced    - recommended + style, idioms, design and layout
//   grails      - Grails add-on preset
//   tests       - JUnit/Spock add-on preset
//   none        - shipped only in `all`

// Every rule of the category that no other tier claimed.
export const REST = "__rest__";

export const RULE_TIERS = {
    // Whole categories of defect rules
    basic: { recommended: REST },
    concurrency: { recommended: REST },
    exceptions: { recommended: REST },
    security: { recommended: REST },
    serialization: { recommended: REST },
    unused: { recommended: REST },

    // Whole categories of style, layout or maintainability rules
    braces: { advanced: REST }, // block braces are layout: the `format` preset carries them
    comments: { advanced: REST }, // Javadoc completeness
    dry: { advanced: REST }, // duplicate literals: maintainability, and noisy on real code
    formatting: { advanced: REST }, // indentation, blank lines, whitespace
    jdbc: { advanced: REST }, // opinions about talking to JDBC directly
    size: { advanced: REST }, // class/method size and complexity thresholds

    // Framework and tooling categories, opt-in through their own preset
    grails: { grails: REST },
    junit: { tests: REST },

    // Inert until configured (IllegalRegex, RequiredString...): shipped only in `all`
    generic: { none: REST },

    convention: {
        recommended: [
            "HashtableIsObsolete", // obsolete synchronized collection
            "LongLiteralWithLowerCaseL", // 1l reads as 11
            "VectorIsObsolete", // obsolete synchronized collection
        ],
        advanced: REST,
    },

    design: {
        recommended: [
            "AssignmentToStaticFieldFromInstanceMethod", // shared mutable state, thread hazard
            "BooleanMethodReturnsNull", // NPE on unboxing at every call site
            "BuilderMethodWithSideEffects", // a create*() that mutates
            "CloneableWithoutClone", // Cloneable contract not honoured
            "CompareToWithoutComparable", // compareTo() ignored by sorting APIs
            "LocaleSetDefault", // JVM-wide side effect
            "ReturnsNullInsteadOfEmptyArray", // NPE-prone contract
            "ReturnsNullInsteadOfEmptyCollection", // NPE-prone contract
            "SimpleDateFormatMissingLocale", // parses differently per machine
            "ToStringReturnsNull", // NPE in string interpolation
        ],
        advanced: REST,
    },

    // Splitting `enhanced` matters: these rules need CodeNarc compilation phase 4, which roughly
    // doubles a lint run. They are in `advanced`, not `recommended`, because they also fire very
    // rarely - see the spec for the measurement.
    enhanced: {
        tests: ["JUnitAssertEqualsConstantActualValue"],
        advanced: REST,
    },

    groovyism: {
        recommended: [
            "CollectAllIsDeprecated", // deprecated API
            "ConfusingMultipleReturns", // def a, b = [1, 2] does not do what it looks like
            "GStringAsMapKey", // a GString key never matches its String lookup
            "GStringExpressionWithinString", // ${..} in a single-quoted string is not interpolated
            "GroovyLangImmutable", // deprecated in favour of groovy.transform.Immutable
        ],
        advanced: REST,
    },

    imports: {
        recommended: [
            "DuplicateImport",
            "ImportFromSamePackage",
            "ImportFromSunPackages", // sun.* is not portable across JDKs
            "UnnecessaryGroovyImport",
            "UnusedImport",
        ],
        advanced: REST, // MisorderedStaticImports, NoWildcardImports: ordering conventions
    },

    logging: {
        recommended: [
            "LoggerForDifferentClass", // log lines attributed to the wrong class
            "LoggerWithWrongModifiers",
            "LoggingSwallowsStacktrace",
            "MultipleLoggers",
            "PrintStackTrace",
        ],
        advanced: REST, // Println, SystemErrPrint, SystemOutPrint: printing is not a mistake
    },

    naming: {
        recommended: [
            "ClassNameSameAsFilename",
            "ClassNameSameAsSuperclass",
            "ConfusingMethodName",
            "InterfaceNameSameAsSuperInterface",
            "ObjectOverrideMisspelledMethodName", // a misspelled equals() is never called
            "PackageNameMatchesFilePath",
        ],
        advanced: REST, // ClassName, MethodName, VariableName...: naming conventions
    },

    unnecessary: {
        recommended: [
            "UnnecessaryBooleanExpression", // a constant operand makes the condition constant
            "UnnecessaryCollectionCall", // list.containsAll(list) and friends
            "UnnecessaryInstanceOfCheck", // always true or always false
            "UnnecessaryModOne", // x % 1 is always 0
            "UnnecessarySelfAssignment",
        ],
        advanced: REST,
    },
};

// Severities and rule properties applied on top of the tiers, whichever preset the rule lands in.
export const RULE_CONFIG = {
    "basic.DeadCode": "error",
    "convention.CompileStatic": { severity: "info" },
    "convention.FieldTypeRequired": "info",
    "convention.NoDef": "info",
    "convention.VariableTypeRequired": "info",
    "dry.DuplicateListLiteral": "info",
    "dry.DuplicateMapLiteral": "warning",
    "dry.DuplicateNumberLiteral": { ignoreNumbers: [0, 1, 2, 3, -1], severity: "info" },
    "dry.DuplicateStringLiteral": "info",
    "exceptions.ThrowException": "info",
    "exceptions.ThrowNullPointerException": "info",
    "exceptions.ThrowRuntimeException": "info",
    "exceptions.ThrowThrowable": "info",
    "formatting.BracesForClass": "info",
    "formatting.BracesForForLoop": "info",
    "formatting.BracesForIfElse": "info",
    "formatting.BracesForMethod": "info",
    "formatting.BracesForTryCatchFinally": "info",
    "formatting.Indentation": { spacesPerIndentLevel: 4, severity: "info" },
    "groovyism.ExplicitCallToEqualsMethod": "info",
    "unused.UnusedArray": "error",
    "unused.UnusedObject": "error",
    "unused.UnusedPrivateField": "error",
    "unused.UnusedPrivateMethod": "error",
    "unused.UnusedPrivateMethodParameter": "error",
    "unused.UnusedVariable": "error",
};

// Overrides applied on top of a base preset, not a rule list of their own. Composed as
// { "extends": ["recommended", "jenkinsfile"] }.
export const OVERRIDE_PRESETS = {
    jenkinsfile: {
        // Jenkinsfiles are scripts: dynamic typing and loose naming are the point
        "convention.CompileStatic": "off",
        "convention.NoDef": "off",
        "convention.VariableTypeRequired": "off",
        "convention.MethodReturnTypeRequired": "off",
        "convention.FieldTypeRequired": "off",
        "convention.MethodParameterTypeRequired": "off",
        "groovyism.ExplicitCallToEqualsMethod": "off",
        // '${env.FOO}' in single quotes is deliberate: the shell interpolates it, not Groovy
        "groovyism.GStringExpressionWithinString": "off",
        "naming.VariableName": "off",
        "naming.FactoryMethodName": "off",
        "unnecessary.UnnecessaryGetter": "off",
        // Pipelines nest deeply by nature, but a runaway nesting is still worth reporting
        "size.NestedBlockDepth": { maxNestedBlockDepth: 10 },
        "unused.UnusedVariable": { ignoreVariableNames: "_" },
    },
};

// The generated presets. `rules` presets list rules explicitly; `extends` presets only compose.
export const GENERATED_PRESETS = [
    {
        name: "recommended",
        tiers: ["recommended"],
        header: "The default preset: the CodeNarc rules whose violations are most likely mistakes.",
    },
    {
        name: "advanced",
        tiers: ["recommended", "advanced"],
        header: "recommended plus the style, idiom, design, documentation and layout rules.",
    },
    {
        name: "grails",
        tiers: ["grails"],
        header: 'Grails add-on. Compose it: { "extends": ["recommended", "grails"] }.',
    },
    {
        name: "tests",
        tiers: ["tests"],
        header: 'JUnit and Spock add-on. Compose it: { "extends": ["recommended", "tests"] }.',
    },
    {
        name: "jenkinsfile",
        overrides: "jenkinsfile",
        header: 'Jenkinsfile add-on. Compose it: { "extends": ["recommended", "jenkinsfile"] }.',
    },
    {
        name: "recommended-jenkinsfile",
        extends: ["recommended", "jenkinsfile"],
        header: "Kept for compatibility: the composition of recommended and the jenkinsfile add-on.",
    },
];
