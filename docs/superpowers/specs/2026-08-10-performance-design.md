# npm-groovy-lint performance: diagnosis and design

Date: 2026-08-10
Status: Approved design, ready for implementation planning

## Problem

Linting is dramatically slower than comparable linters. Measured baseline on a
20-file / 18,940-line Groovy corpus (8 cores, JDK 17, warm CodeNarc server):
**31–66 s**, i.e. roughly 350 lines/second. A single 50-line file takes ~1.9 s
warm, which is too slow for the VS Code extension's interactive path.

Node-side cost is negligible. Instrumentation (`NODE_DEBUG=npm-groovy-lint`)
shows `CodeNarcServer call result: (200) 53841ms` against a ~60 s wall clock:
essentially all the time is inside the JVM.

## Diagnosis

All figures below were measured directly against the bundled jars. Absolute
numbers varied run to run (28–62 s for identical work, because benchmarking
loaded the machine); the **ratios** were reproduced across repetitions and are
what the design relies on.

### 1. The default preset runs 386 rules (dominant cause)

`lib/.groovylintrc-recommended.json` begins with `"extends": "all"` and then
overrides only 31 rules. "Recommended" is therefore *all 390 CodeNarc rules*
with a few tweaked — 386 active after overrides.

| Ruleset | Time (same corpus) |
| --- | --- |
| 10 rules | ~1.0 s |
| 60 rules | ~1.8 s |
| **386 rules (default)** | **~36–50 s** |

Cost is **additive per rule**, not superlinear: bisecting the 386 rules into
60-rule chunks gives times summing to ~53 s, against ~45.6 s for all 386 at
once. Each rule is an independent AST traversal, so every file is walked ~386
times. GC is not a factor (345 ms of a 45 s run).

### 2. All analysis is single-threaded

The `Executors.newFixedThreadPool` at `groovy/src/main/com/nvuillam/CodeNarcServer.groovy:129`
parallelizes *concurrent HTTP requests* only. A single lint request processes
every file sequentially, using one core of eight.

Partitioning files across threads was validated to produce **identical output**:

| Threads | Time | Violations |
| --- | --- | --- |
| 1 | 64.3 s | 35,600 |
| 2 | 71.4 s | 35,600 |
| 4 | 30.8 s | 35,600 (**2.09x**) |
| 8 | 32.6 s | 35,600 (1.97x) |

Speedup plateaus at ~2x around 4 threads, well short of core count. The likely
causes (shared classloader contention, memory bandwidth during AST traversal)
were not investigated; the plateau is treated as an empirical fact and the
thread cap is set from it.

### 3. Five rules cost ~9.4 s and report nothing

`CloneWithoutCloneable`, `JUnitAssertEqualsConstantActualValue`,
`MissingOverrideAnnotation`, `UnsafeImplementationAsMap` and
`GrailsDomainGormMethods` require compiler phase 4 (semantic analysis). CodeNarc
compiles each file a second time at that phase; because npm-groovy-lint never
passes a user classpath, it fails with `unable to resolve class` and the work is
discarded. Measured alone on the corpus: **9,391 ms, `p1=0; p2=0; p3=0`**.

Four of these rank in the top 7 most expensive individual rules. Each also emits
a full stack trace per file per run, which logback then formats.

Caveat: on a file with no unresolvable imports the semantic compile can succeed,
so these rules are not *universally* dead — only for any realistic file with
third-party imports.

### 4. The `--parse` step compiles to bytecode unnecessarily

`groovy/src/main/com/nvuillam/Request.groovy:236` calls `loader.parseClass(...)`,
a full compilation, purely to collect syntax errors. Only the CONVERSION phase is
needed.

| Strategy | Time (20 files) |
| --- | --- |
| per-file `parseClass` (current) | 767 ms |
| per-file `CompilationUnit` @ CONVERSION | 662 ms |
| **single shared `CompilationUnit` @ CONVERSION** | **153 ms** |

### 5. Whitespace rules dominate the per-rule ranking

`SpaceAfterComma` is the single most expensive rule; roughly ten `Space*` rules
each perform an independent full traversal. `DuplicateNumberLiteral`,
`SpaceAfterMethodCallName` and `Indentation` follow.

## Decisions

1. **Staged.** Stage 1 is engine work plus caching; Stage 2 curates the default
   ruleset. Recorded because Stage 2 is where the order-of-magnitude win is —
   Stage 1 realistically lands at ~2.5–3x.
2. **All three scenarios** (CI/MegaLinter bulk, VS Code interactive, local CLI)
   weigh equally; optimize the shared engine path.
3. **Parallelism lives inside the Groovy server**, not in Node and not across
   processes: one JVM, one warm JIT, one heap, no protocol change.
4. **Cache is in-memory in the server**, bounded LRU. Fully serves VS Code and
   repeated local CLI; deliberately gives up fresh-CI-container benefit in
   exchange for eliminating the stale-cache-on-disk class of bug.

## Design

### Architecture

Parallelism and caching require the same new capability: CodeNarc no longer
produces one authoritative report per run, since some files come from cache and
others from different partitions. One merge component serves both.

Three components, all under `Request.process()`:

**`ResultCache`** — bounded LRU keyed on
`sha256(relativePath + fileContent + rulesetJson + codeNarcVersion + serverVersion)`,
storing `{violations, parseErrors}`. Dependency-free (`LinkedHashMap` in access
order behind a lock), capped at **5,000 entries** by default and configurable;
entries are small (a violation list per file), so this is a soft-memory decision
rather than a tuned one.

The relative path is part of the key because some rules (package-name checks)
depend on file location, not only content. Per-file caching is sound only
because CodeNarc rules are per-`SourceFile` with no cross-file analysis.

**`AnalysisPartitioner`** — splits cache-miss files across a **dedicated** thread
pool, capped at `min(cores, files, 4)`. The cap costs nothing: 4 threads was the
measured plateau. This pool must be separate from the HTTP executor at
`CodeNarcServer.groovy:129`; submitting analysis work to the pool that is serving
the request deadlocks under load.

Each partition builds its own `CodeNarc` instance with `CapturePlugin` and
`CapturedReportWriter`. That path never touches the global `System.out` and was
verified to yield identical results. (`CapturedReportWriter` already documents
itself as existing "so we can safely run concurrent lints".)

**`ResultMerger`** — folds cached violations and per-partition JSON into one
result and **recomputes** the summary (`priority1/2/3`, `totalFiles`,
`filesWithViolations`) rather than summing per-partition summaries. The `rules`
block (descriptions, used by `--returnrules` and SARIF output) is ruleset-derived
and taken once.

The Node side is unchanged: same endpoint, same response shape, so
`lib/codenarc-factory.js` and the VS Code extension need no edits.

### Data flow

1. `listFiles()` — unchanged Ant scan.
2. Compute the ruleset fingerprint once per request.
3. Probe the cache per file. Hits collect `{violations, parseErrors}`; misses
   form the partition list.
4. Partition misses across the pool. Each worker runs CodeNarc over its subset
   by passing explicit relative paths in `-includes` — the mechanism used in the
   validation benchmark.
5. `ResultMerger` combines cached and partition results, recomputing the summary.
6. Store only successful misses.

### Parse step

Replace per-file `parseClass` with one shared `CompilationUnit` per partition at
`Phases.CONVERSION`.

Risk: a single unit stops once `ErrorCollector` reaches its tolerance, which
would silently drop parse errors for later files. Mitigation: raise the compiler
`tolerance`, attribute each error via its `SyntaxException` `sourceLocator`, and
fall back to per-file compilation for that partition if aggregation fails. Clean
code takes the 153 ms path; code with syntax errors degrades to ~662 ms, still
no worse than the current 767 ms.

This fallback behaviour must be validated during implementation; it is the one
part of the design resting on reasoning about Groovy compiler internals rather
than on a measurement.

### Dead rules

Disable the five phase-4 rules in the default preset.

This is a genuine behaviour change, not a pure optimization, and should be
documented as such in the changelog rather than presented as free. Users can
re-enable them in `.groovylintrc`. Rationale: without a user classpath they
report nothing while costing ~9.4 s.

Removing them also eliminates the per-file stack-trace logging storm, which was
their only source.

### Error handling

- **Partition failure** — retry that partition sequentially once, then surface
  as a request error so Node's existing direct-java fallback applies. Never
  cache results from a failed partition.
- **OOM** — N concurrent CodeNarc instances multiply peak heap against the
  current `-Xmx2048m` default (`lib/codenarc-caller.js:29`). Raise the server
  default to `-Xmx4096m` when parallelism is enabled, and on OOM drop to
  single-threaded and retry once. The 4096 figure is a proportional starting
  point for a 4-way cap, not a measured requirement; implementation should
  confirm peak heap under the golden-equivalence corpus.
- **Cancellation** — duplicate-`requestKey` cancellation currently interrupts the
  request thread (`CodeNarcServer.groovy:198`). With a worker pool that interrupt
  no longer reaches the working threads, so it must propagate to the partition
  futures, with workers checking interruption between files. Without this, a
  superseded VS Code keystroke leaves workers burning CPU.

### Testing

- **Golden equivalence** (load-bearing): every fixture linted sequentially and
  uncached must deep-equal the same fixture linted parallel and cached. This
  generalizes the check that produced 35,600 violations identically at 1, 2, 4
  and 8 threads.
- **Cache correctness**: content change, ruleset change and path change each
  invalidate.
- **Concurrency**: concurrent requests with duplicate `requestKey`s, asserting
  cancellation works and results do not cross-contaminate.
- **Performance**: reported as **advisory, not a failing gate.** Measured
  variance was 28–62 s for identical work; a hard threshold would be flaky in CI
  and would train contributors to ignore it.

### Stage 2 rollout

**Stage 2 is out of scope for this spec's implementation plan and needs its own
spec.** Curating a rule list is a product judgement about which rules earn their
place, not an engineering task, and it should not be planned as an appendix to
engine work.

Sketch, so the staging is legible: curate `recommended` as an explicit rule list,
ranking cost against value using the per-rule profiling harness built during this
investigation. Ship as an opt-in preset in a minor release, gather feedback, then
flip the default in the next major with `extends: all` documented as the one-line
restore path.

## Expected outcome

| Change | Expected |
| --- | --- |
| Drop 5 dead rules + logging storm | ~9 s off the benchmark corpus |
| Parse step | 5x on the parse phase |
| Parallelism (cap 4) | ~2x overall |
| Cache | near-zero on repeat lints (VS Code, local CLI) |
| **Stage 1 combined** | **~2.5–3x, first run** |
| **Stage 2 (curated ruleset)** | **~10x** |

## Out of scope

Roughly ten `Space*` rules each perform independent AST traversals. Consolidating
them would be an upstream CodeNarc contribution, not a change npm-groovy-lint can
make locally. Recorded for a possible future contribution.

On-disk caching (which would serve fresh CI containers) was considered and
deferred, along with its serialization, eviction, corruption and concurrent-writer
surface.
