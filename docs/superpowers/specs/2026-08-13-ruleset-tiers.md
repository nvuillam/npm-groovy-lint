# npm-groovy-lint ruleset tiers

Date: 2026-08-13
Status: Implemented

Supersedes the *selection criterion* of
[`2026-08-12-ruleset-curation.md`](2026-08-12-ruleset-curation.md). That work curated
`recommended` to make a lint run 2x faster and kept a rule when it was cheap. The
measurements it recorded stand; the criterion does not. `recommended` is a product
statement about which rules earn a place in **everyone's** default run, and cost is not
what decides that.

## Decisions

1. **Value, not cost, decides `recommended`.** The criterion is ESLint's:

   > A rule belongs to `recommended` when a violation is most likely a **mistake** - code
   > that does not do what its author meant, that is dead or unreachable, that is a
   > security or concurrency hazard, or that misuses a well-known API. A rule that
   > expresses a preference between two correct ways of writing the same thing belongs to
   > `advanced`.

2. **Tiers, not a single curated list.** `recommended` ⊂ `advanced` ⊂ `all`, plus
   composable framework add-ons. Nothing is *removed* from the product - everything a user
   had before is one preset name away.

3. **`recommended` carries no layout rule at all.** Layout is what `format` is for, and
   `--fix`/`--format` apply it. This is the same conclusion the curation reached for the
   13 `Space*` rules, on a criterion that also covers `Indentation` and the braces rules.

4. **The presets are generated from a single classification table**, so a rule cannot be
   in `recommended` but missing from `advanced`, and a new CodeNarc rule cannot join a
   preset silently.

## The tiers

| Preset | Rules | Contents |
|--------|-------|----------|
| `recommended` (default) | 149 | Likely mistakes |
| `advanced` | 344 | `recommended` + style, idioms, design, naming, size, Javadoc, layout |
| `all` | 390 | Every CodeNarc rule, including the inert-until-configured `generic` ones |
| `format` | 40 | Layout only (unchanged, hand-maintained) |
| `grails` | 12 | Grails add-on |
| `tests` | 25 | JUnit + Spock add-on (the `junit` category and `enhanced.JUnitAssertEqualsConstantActualValue`) |
| `jenkinsfile` | 13 | Overrides that relax a tier for pipelines |
| `recommended-jenkinsfile` | - | `["recommended", "jenkinsfile"]`, kept for compatibility |

`extends` now accepts a list, merged left to right, so add-ons compose:
`{ "extends": ["advanced", "grails", "tests"] }`.

### What `recommended` keeps whole

`basic`, `concurrency`, `exceptions`, `security`, `serialization`, `unused` - every rule,
including the ones that never fired on the 66k-line corpus. A rule that fires rarely is
cheap in noise and valuable when it does fire.

### What it takes rule by rule

`convention`, `design`, `groovyism`, `imports`, `logging`, `naming` and `unnecessary` are
split: the mistake-shaped rules are in, the preference-shaped ones are in `advanced`. Some
examples of the line being drawn:

| In `recommended` | In `advanced` | Why |
|------------------|---------------|-----|
| `GStringAsMapKey` | `ExplicitCallToEqualsMethod` | A GString key never matches its String lookup; `a.equals(b)` works fine |
| `ObjectOverrideMisspelledMethodName` | `MethodName` | A misspelled `equals()` is never called; a naming convention is a convention |
| `LongLiteralWithLowerCaseL` | `TrailingComma` | `1l` reads as `11` |
| `UnnecessaryModOne` | `UnnecessaryReturnKeyword` | `x % 1` is always 0, so the expression is not what its author meant |
| `ImportFromSunPackages` | `NoWildcardImports` | `sun.*` is not portable across JDKs |
| `HashtableIsObsolete` | `Instanceof` | Obsolete API, not a matter of taste |

Full diff against the 244-rule preset it replaces: **103 rules moved to `advanced`** (all
of `braces`, `dry`, `size`, the 21 `formatting` rules, 21 `convention`, 20 `unnecessary`,
10 `naming`, 7 `design`, 7 `groovyism`, 2 `imports`, 2 `logging`), and **8 rules were
added** on value grounds - `HashtableIsObsolete`, `VectorIsObsolete`,
`CollectAllIsDeprecated`, `ConfusingMultipleReturns`, `GroovyLangImmutable`,
`UnnecessaryCollectionCall`, `UnnecessaryInstanceOfCheck`, `UnnecessaryModOne`.

### Deliberate exclusions

- **`generic`** (`IllegalRegex`, `RequiredString`...) does nothing until configured, so it
  ships only in `all`.
- **`grails`, `junit`** are framework-specific: they are add-ons, not a default.
- **The `enhanced` category** needs CodeNarc compilation phase 4. The curation measured
  that removing those rules *halved* a run over 66k lines and cost **one** violation,
  because npm-groovy-lint passes no user classpath so they cannot resolve imported
  classes. They are in `advanced` (and `tests`), not in `recommended`. This is the one
  place where a cost measurement still informs the placement, and it is recorded here
  rather than hidden: the rules are real defect rules, they are simply near-blind in this
  tool. Users who want them have `advanced`, or one line in their own `rules` block.

## Consequences

### `--fix` is unaffected

`--fix` merges the `format` preset on top of the lint ruleset
(`NpmGroovyLint.addFormattingRulesForFix`), so it still repairs indentation, braces and
spacing byte-for-byte. Only rules the lint config does not mention are added, so a rule
set to `"off"` stays off.

Two bugs surfaced when `recommended` stopped carrying layout, both fixed:

- `fixAgainAfterFix` built its ruleset by intersecting the triggered rules with the lint
  config. With no `Indentation` in the config the intersection was empty, optionator
  rejected the empty `rulesets`, and the run crashed on `Cannot convert undefined or null
  to object`. A triggered rule now runs bare when the lint config does not mention it.
- That fallback then sent the npm-groovy-lint-only rules (`IndentationClosingBraces`,
  `IndentationComments`) to CodeNarc, which rejects unknown rule names. They are filtered
  out of `rulesets` and still passed through `fixrules`.

### Reporting is much quieter by default

On `lib/example`, the default preset goes from 331 warnings / 1260 infos to 11 / 9. That is
the point: what remains is what is most likely wrong. `advanced` reports the rest.

The VS Code extension follows: quick-fixes are offered for reported errors, so a user who
wants layout diagnostics in the editor should extend `["recommended", "format"]` or
`advanced`. A `--fix` run repairs layout either way.

### One wart, recorded

The `jenkinsfile` add-on sets `size.NestedBlockDepth: { maxNestedBlockDepth: 10 }`. Under
`advanced` that relaxes a rule that would otherwise fire on every pipeline; under
`recommended`, which carries no `size` rule, it *enables* one at a depth that only a
runaway pipeline reaches. Keeping it is the lesser evil: the alternative is a
property-override notation that only applies when the rule is already enabled, which the
config format cannot express.

## Implementation

- `scripts/rule-tiers.js` - the classification table, the severity/property overrides, and
  the list of generated presets. Categories are declared whole (`{ recommended: REST }`) or
  split by naming the picks and letting `REST` take the remainder.
- `scripts/build-config-all.js` - generates every preset but `format` from that table and
  from `lib/example/RuleSet-All.groovy`. It **throws** when a category is missing from the
  table, when a listed rule does not exist, when two tiers claim the same rule, or when a
  rule ends up in no tier. This is what keeps a future CodeNarc release from growing
  `recommended` silently.
- `lib/config.js` - `manageExtends` accepts a string or a list; bases merge left to right
  and the config's own rules win over all of them.
- The generated presets are listed in `.prettierignore`, like `.groovylintrc-all.json`
  already was, so prettier and the generator do not rewrite each other.

## Out of scope

- `format` stays hand-maintained: it is the list of rules the formatting engine knows how
  to apply, not a tier of the lint rulesets.
- No new performance measurement was run. The curation's corpus and figures remain the
  reference, and `recommended` is now a smaller set than the 244 they were measured on.
- Consolidating the `Space*` traversals upstream in CodeNarc, still worth contributing.
