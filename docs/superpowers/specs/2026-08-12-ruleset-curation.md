# npm-groovy-lint performance Stage 2: ruleset curation

Date: 2026-08-12
Status: Implemented

Follows [`2026-08-10-performance-design.md`](2026-08-10-performance-design.md), which
deferred Stage 2 on the grounds that "curating a rule list is a product judgement
about which rules earn their place, not an engineering task".

## Decisions

1. **Shipped as a major.** `recommended` is curated directly rather than introduced
   as an opt-in preset. `{ "extends": "all" }` is the documented restore path.
2. **The preset lists its rules explicitly** instead of `extends: all` plus
   overrides. This is the root-cause fix: under `extends: all`, every rule a future
   CodeNarc release adds joins `recommended` silently, which is how it reached 386
   rules. An explicit list makes new rules opt-in.
3. Scope included investigating non-rule overhead. It was investigated and found
   to be a dead end — see below.

## Corpus

The Stage 1 corpus was one 947-line file duplicated 20 times. Adequate for
throughput work, useless for deciding which rules earn their place: it exercises
one file's constructs, so whole categories look dead when they are merely
unexercised.

Stage 2 used a new corpus: **649 files / 66,369 lines**, sampled evenly (every Nth
file by sorted path, capped at 200 per project) from CodeNarc, Spock, grails-core
and jenkinsci/pipeline-examples.

Caveats, recorded rather than hidden:

- CodeNarc's own repository contributes test sources that deliberately contain
  violations, inflating some counts.
- grails-core is sampled at 1-in-32, so the `grails` category's near-silence on
  this corpus is weak evidence.
- Only 49 Jenkinsfile-ish files, so `recommended-jenkinsfile` is not well covered.
- Spock sources use AST transforms CodeNarc cannot always compile; those files
  contribute less rule work than their size suggests.
- **Run-to-run spread on this workload is 25-50%** for identical work. Every
  figure below is a median of 3-4 interleaved rounds. Treat ratios as approximate;
  an early single-run comparison produced self-contradictory orderings (a 236-rule
  set appearing faster than a 178-rule one) and was discarded.

## Baseline

| | pre-Stage-1 (386 rules) | Stage 1 `recommended` (381) |
|---|---|---|
| CodeNarc over the corpus | 270.1 s | 139.5 s |
| Violations | 26,865 | 26,864 |
| Distinct rules firing | 159 | 158 |

Stage 1's removal of the five phase-4 rules halved the run and cost **one**
violation across 66k lines of real code — stronger validation of that decision than
the Stage 1 corpus could provide.

**223 of 381 rules never fire on this corpus.** That is not by itself an argument
for dropping them: a rule that rarely fires is cheap in noise and valuable when it
does. The argument is narrower — cost is paid per rule *whether or not it fires*,
so a silent rule must justify its cost on the value of the case it would catch.

## Where the time goes

Measured by applying each rule directly to a pre-parsed `SourceFile`, single pass,
so first-call costs are counted as CodeNarc pays them:

| | |
|---|---|
| Parse (649 files) | 10.5 s (7%) |
| Rule application | 69.2 s (46%) |
| CodeNarc driver + report building | 69.8 s (47%) |

### The overhead avenue is closed

Two earlier estimates were wrong and are recorded so they are not repeated:

- **~170 ms/file of fixed overhead** — wrong. It came from regressing two corpora
  with different content against each other, and the five phase-4 rules Stage 1
  removed were doing the work it attributed to fixed overhead.
- **Rule application is only 19% of a run** — wrong. That harness took the faster
  of two applications per (rule, file), discarding first-call costs and
  undercounting rule work by 2.5x.

Measured correctly, the non-rule half is CodeNarc walking files, filtering
violations and building a report over 26,864 violations. No redundant parsing, no
per-rule waste. Curation shrinks part of it too, since fewer rules means fewer
violations to process.

## The finding: 13 rules were 45% of a lint run

Cost is **not** proportional to rule count. Candidate rulesets, medians:

| ruleset | rules | median | speedup | violations |
|---|---|---|---|---|
| current | 381 | 88.8 s | 1.00x | 26,864 (100%) |
| − the 13 `Space*` only | 368 | 54.1 s | 1.64x | 26,568 (98.9%) |
| moderate − `Space*` | 236 | 35.7 s | 2.49x | 25,482 (94.9%) |
| lean − `Space*` | 178 | 25.0 s | 3.55x | 13,571 (50.5%) |
| lint-focused (all layout to `--format`) | 158 | 21.2 s | 4.19x | 5,922 (22.0%) |

Dropping 132 rules (381→249) buys 1.16x. The next 33 buy the remaining 2.2x.
Isolating them:

| ruleset | rules | median | violations |
|---|---|---|---|
| `Indentation` alone | 1 | 11.6 s | 5,993 |
| the 13 `Space*` rules alone | 13 | 25.8 s | **296** |
| lean − `Indentation` | 190 | 77.3 s | 7,874 |
| lean − `Space*` | 178 | 46.1 s | 13,571 |

Against the ~11 s floor: `Indentation` costs ~0.6 s and finds 5,993 violations. The
13 `Space*` rules cost **37.4 s and find 296** — roughly 126 ms per finding against
0.1 ms for `Indentation`.

The Stage 1 spec noted these rules each perform an independent full traversal and
filed it as a possible upstream CodeNarc contribution. It is not a footnote — it is
the performance problem, and curation resolves it locally without waiting on
upstream. The upstream consolidation remains worth contributing.

**Caveat on the value side.** The cost measurement is solid. "296 violations" is
not a strong argument on its own: the corpus is four well-formatted open-source
projects, and on messy or Jenkinsfile-heavy code these rules would fire far more.
The case for moving them out of `recommended` rests on all 13 already being in the
`format` preset, so `--format` continues to report *and fix* spacing.

## What shipped

**244 rules**, measured at **2.07x** with **94.9%** of violations retained.

Selection:

- **Kept whole** — the categories that catch defects, including their silent rules:
  `basic`, `security`, `exceptions`, `concurrency`, `serialization`, `braces`,
  `unused`, `imports`, `size`, `logging`, `naming`.
- **Dropped** — framework- and tool-specific or inert-until-configured:
  `grails`, `jdbc`, `junit`, `comments`, `generic`.
- **Dropped** — the 13 `Space*` rules (all still in `format`).
- **Stylistic categories** (`unnecessary`, `groovyism`, `design`, `dry`,
  `convention`, `formatting`) kept a rule only if npm-groovy-lint has `fix()` logic
  for it or it fired on the corpus.
- **Re-added by hand** — eight rules the mechanical criterion dropped only because
  the corpus did not exercise them, but which describe defects rather than style:
  `BooleanMethodReturnsNull`, `CompareToWithoutComparable`, `CloneableWithoutClone`,
  `ToStringReturnsNull`, `LocaleSetDefault`, `ReturnsNullInsteadOfEmptyCollection`,
  `ReturnsNullInsteadOfEmptyArray`, `LongLiteralWithLowerCaseL`. Applying the
  "fixable or fired" rule to them would have contradicted the reasoning that keeps
  `basic` and `security` whole.

Kept deliberately: `Indentation` and the braces/blank-line rules, so `--fix` still
repairs layout; and `NoDef` / `CompileStatic` / `*TypeRequired`, which users
configure today.

All 26 severities and rule properties `recommended` previously configured are
preserved. All 11 `recommended-jenkinsfile` overrides still target rules present in
the curated set.

## Out of scope

- `all` is untouched: the complete 390-rule list, and the restore path.
- `format` is self-contained and unaffected.
- Consolidating the `Space*` traversals upstream in CodeNarc.
