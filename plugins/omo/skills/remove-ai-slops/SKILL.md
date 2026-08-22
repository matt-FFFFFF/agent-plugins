---
name: remove-ai-slops
description: "Remove AI-generated code smells (slop) from branch changes or an explicit file list. Locks behavior with regression tests FIRST, then runs categorized cleanup delegated to sisyphus-junior in batches of 5, then verifies with quality gates and a critical review. Covers 10 slop categories including performance equivalences, excessive complexity, and oversized modules (250+ pure LOC, with mandatory modular refactoring). Triggers: remove ai slops, clean ai code, deslop, cleanup AI generated, remove AI slop, clean up AI-generated code, strip slop, ai-slop cleanup."
---

# Remove AI Slops

## Inputs

- **Default scope**: branch diff vs `merge-base main` (no arguments needed).
- **Optional scope**: an explicit file list passed by the caller.

## What this does

Cleans AI-generated slop from a bounded set of changed files while strictly preserving behavior. Locks behavior with regression tests first, then runs a categorized multi-pass cleanup, then verifies with quality gates and a critical review. Reverts and hand-fixes when verification fails.

The core safety invariant: **behavior is locked by green tests before a single line is removed**. A checklist alone is not safety; a passing regression test is.

---

## Categories (what counts as slop)

The first three are stylistic, the next three structural, the next two about hidden cost, the last two about behavior coverage and file size.

### Stylistic

1. **Obvious comments** — comments restating code, trivial docstrings, section dividers, commented-out code, vague TODOs/Notes.
   - KEEP: comments explaining WHY (business logic, edge cases, workarounds), ticket links, regex/algorithm explanations, BDD markers (`# given`/`# when`/`# then`).

2. **Over-defensive code** — null checks for guaranteed values, try/except around code that can't raise, isinstance checks for statically typed params, default values for required params, backward-compat shims, redundant validation duplicated at multiple layers, broad exception catching (`except Exception`, empty `catch {}`, `catch (e) { console.error(e) }` without narrowing).
   - KEEP: validation at system boundaries (user input, external APIs), I/O error handling, nullable DB fields. A top-level boundary catch-all (CLI `main()`, HTTP handler) with explicit logging + re-raise is acceptable.
   - REFACTOR: `except Exception` → the specific exception you expect. Empty `catch {}` → `instanceof` narrowing or re-throw.
   - **Proof required**: before deleting any validation or error handling at a trust boundary, write an adversarial regression test (malformed/hostile input) that fails if the guard is removed. No adversarial test → the guard stays.

3. **Excessive complexity** — deep nesting (>3 levels), nested ternaries, complex boolean expressions (4+ predicates), long parameter lists (>5 args without a struct/object), god functions (>50 lines doing many things), clever one-liners that sacrifice readability, `if/elif/else` chains for type/enum discrimination (should be `match`/exhaustive switch), `object`/`any` used as a type annotation (should be a protocol/generic/explicit union).
   - KEEP: established complexity patterns in this codebase, intentionally complex hot-path idioms, plain `if/else` for boolean conditions and range checks (not variant discrimination).

### Structural

4. **Needless abstraction** — pass-through wrappers, single-use helpers, speculative indirection ("we might need this later"), interfaces with one implementer that add no testability win, factory functions that just call a constructor.
   - KEEP: abstractions that provide a real seam (testability, multiple implementers, a framework-required boundary).

5. **Boundary violations** — wrong-layer imports (UI importing a DB driver), leaky responsibilities (a handler doing business logic that belongs in a service), hidden coupling (module A reads module B's private state), side effects in pure-named functions.
   - KEEP: pragmatic short-circuits already established as a pattern here. Flag for human judgment if unsure.

6. **Dead code** — unused imports, unused private functions/methods, unreachable branches, stale feature flags, debug leftovers (`console.log`, `print(...)`, `dbg!`), removed-but-still-referenced code.
   - KEEP: code reached via reflection/dynamic dispatch/string lookup, or intentionally kept as a feature-flag rollback path (verify with the user).

### Hidden cost

7. **Duplication** — copy-pasted branches with trivial differences, redundant helpers doing the same thing in two places, repeated magic-number sequences.
   - KEEP: incidental duplication — two pieces of code that look similar but serve different intents that could diverge. Prefer leaving them separate over a premature shared abstraction.

8. **Performance equivalences** — changes provably equivalent in semantics but cheaper: O(n²)→O(n) when correctness is preserved, hoisting repeated computation out of a loop, avoiding an unnecessary eager collection, string-concat-in-loop → join, batching redundant DB/API calls, caching a recomputed `.length`/`len()`.
   - **Hard rule**: only when equivalence is obvious. Never change algorithms with subtle correctness implications. Never micro-optimize a hot path without a benchmark. If in doubt, SKIP.

### Behavior coverage & size

9. **Missing tests** — behavior present in changed files not locked by any regression test. Fix by ADDING the narrowest test that pins the behavior, never by removing the code. Exception: a prose file (prompt, `SKILL.md`, rule, markdown) has no behavioral seam — don't add a text/word-count/phrase pin for it; cover only a machine-consumed value, or leave it to review.

10. **Oversized modules** — any source file exceeding **250 pure LOC** (non-blank, non-comment). Architectural defect, not style. Measure with `awk '!/^[[:space:]]*$/ && !/^[[:space:]]*(#|\/\/)/' <file> | wc -l`.
    - When found, don't just flag it — refactor it. Use the `check-no-excuse-rules` script for the relevant language from the `programming` skill (`scripts/{python,rust,typescript,go}/check-no-excuse-rules.*`) to list violations, then: identify distinct responsibilities, plan a split naming each new file after the concept it owns (never `utils.py`/`helpers.py`/`common.py`/`part_1.py`), present the split plan to the user, extract into clean modules with explicit re-export-only index files, then re-verify every file is ≤250 pure LOC and tests/typecheck/lint pass.
    - **Forbidden escapes**: counting blanks/comments toward the budget; splitting by token count instead of responsibility; catch-all dump files; "it's generated" (unless it truly lives in a build-output directory); "close enough" at 230 LOC.
    - KEEP: genuinely self-contained single-responsibility scripts (a standalone CLI checker). Opt out with a `# noqa: SIZE_OK` comment in the first 5 lines explaining why.

---

## Quality Gates

A pass is complete only when every applicable gate is green. Skip gates genuinely N/A for the project (no security scanner configured, etc.) and report `N/A` explicitly — never silently skip.

| Gate | Tool | Pass condition |
|---|---|---|
| Regression tests | project's test runner | all green |
| Lint | project's linter | zero errors (pre-existing warnings OK) |
| Typecheck | project's type-checker on changed files | zero new errors |
| Unit/integration tests | project's test runner | all green (pre-existing failures noted, not introduced) |
| Static/security scan | project's scanner | zero new findings, or `N/A` |

---

## Process

### Phase 0: Plan

`TodoWrite` for all phases below; mark `in_progress` one at a time.

### Phase 1: Determine scope

If file paths were passed as arguments, that's the scope. Otherwise:

```bash
git diff $(git merge-base main HEAD)..HEAD --name-only
```

Filter out deleted files, binary files, and generated/vendored files (`node_modules/`, `dist/`, `target/`, lockfiles).

### Phase 2: Lock behavior with regression tests (non-negotiable)

For each in-scope file: identify the public/observable behavior it exposes, check whether existing tests cover it (`git grep` for related test files), and **if uncovered or weakly covered, write the narrowest regression test that pins current behavior BEFORE editing** — pin observable outputs, not implementation details. A prose file (prompt/`SKILL.md`/rule/markdown) is exempt. Run the tests; they must be green before any cleanup begins.

If you can't establish a green baseline (e.g. the test runner is broken), **stop and report** — don't proceed with cleanup on unverified ground.

### Phase 3: Cleanup plan — existence first, then smells

Before categorizing smells, run the deletion ladder on each changed unit:

- **Delete entirely** — the behavior isn't needed (YAGNI, speculative, dead on arrival).
- **Reuse** — an existing helper or pattern in this repo already does it; call it instead.
- **Platform/stdlib/native/dependency** — the language, runtime, or an already-installed dependency already does it (a hand-rolled date picker → `<input type="date">`, a custom debounce → the already-imported util).
- **Simplify in place** — it must exist; make it smaller.

Only code that lands on "simplify in place" proceeds to the smell categories — one function replaced by a platform call is a bigger, safer win than any in-place cleanup, and needs no per-line smell analysis.

For a diff that fixes a bug, `Grep` the callers of every shared function it touches — prefer one root-cause fix at the shared seam over repeated per-caller guards.

Produce an explicit plan before delegating removal work:

```
File: src/foo.py
  Ladder: 2 units simplify-in-place; 1 unit delete (native <input> replaces custom picker)
  Categories: dead code, excessive complexity, performance
  Order: dead code → complexity → performance
  Risk: medium (touches caching layer)
```

**Intentional shortcuts**: if the plan deliberately keeps a bounded simplification (a naive scan fine under N rows, a global lock, an O(n²) path), mark it in-code with a `debt:` comment naming the ceiling and the upgrade trigger, and list it under "Remaining Risks / Deferred" in the final report — that section is the debt ledger.

Order rule (safest → riskiest): comments → dead code → defensive → duplication → complexity → abstraction/boundary → performance → tests → oversized-modules.

### Phase 4: Parallel slop removal, batches of 5

Delegate files to `Agent({subagent_type: "sisyphus-junior", ...})` — its "one bounded task, execute, verify once, stop" discipline is exactly the shape this needs — **batched 5 at a time in parallel**:

1. Slice the in-scope file list into chunks of up to 5.
2. For each chunk, fire all `Agent` calls in a single message.
3. Wait for their notifications, then collect results.
4. Launch the next batch. Repeat until every file is processed. (≤5 files total → one batch.)

Per-file prompt — include the full Categories section above verbatim (the subagent doesn't have this skill loaded, so paste it in), plus:

```
Remove AI slops from: <file_path>

First run the deletion ladder (delete entirely / reuse existing repo code / platform-stdlib-native / simplify in place); only code that must exist proceeds to smell removal.

Then evaluate EVERY category below, applying its KEEP and REFACTOR rules verbatim.
[paste the Categories section here]

Apply changes in this order (safest → riskiest): comments → dead code → defensive → duplication → complexity → abstraction/boundary → performance → oversized-modules.

Hard constraints:
- Behavior MUST be preserved. When equivalence is not obvious, SKIP.
- Do NOT change public API signatures.
- Do NOT remove type hints.
- Do NOT introduce new abstractions or dependencies.
- Diff stays minimal and scoped to slop removal.

Report changes grouped by category. For each change: before/after, why-slop, why-safe. For each skipped issue: reason.
```

A subagent that doesn't report back cleanly (times out, gives an ack with no diff) — retry that one file once. If retry also fails, escalate it under "Issues Found & Fixed" in the final report rather than blocking the rest of the batch.

### Phase 5: Verify with quality gates + critical review

Run the five quality gates above, then walk this checklist:

**Safety**: no functional logic accidentally removed · all error handling preserved (especially I/O/network/external APIs) · type hints intact · imports still valid · no breaking changes to public APIs.

**Behavior**: return values unchanged (verified by Phase 2 tests) · side effects unchanged · exception behavior unchanged · edge cases preserved.

**Quality**: removed changes are genuinely slop, not intentional patterns · remaining code follows project conventions · no orphaned code/dead references · performance changes are obviously equivalent (no subtle algorithm shift) · no new abstractions introduced.

### Phase 6: Fix issues

If any gate fails or any checklist item flips: identify the specific change that caused it, explain why, `git checkout` the affected file (or targeted `Edit` to revert just the problematic hunk), then if genuine slop remains after revert, edit it yourself directly (parallel `Edit` calls across files where independent), applying only changes you can prove are safe. Re-run the failing gate and re-walk the checklist. Repeat until everything's green.

If you fail three times on the same file, **stop and escalate** to the user: the file, what you tried, what failed, your hypothesis. Don't keep editing.

---

## Output Format

```text
AI SLOP REMOVAL REPORT
======================

Scope: [branch diff vs merge-base main / explicit file list]
Files: [N files]
  - path/to/file1.ts
  - path/to/file2.py

Behavior Lock:
  - Existing coverage: [N files already covered]
  - Tests added: [M new regression tests at path/to/test_X.py]
  - Baseline status: GREEN

Cleanup Plan:
  - path/to/file1.ts: [ladder: 1 delete (native) + simplify-in-place] → [dead code → complexity → performance]

Per-File Results (each cut shows what replaces it):
  path/to/file1.ts
    - Ladder/delete: custom DatePicker (48 lines) → <input type="date"> (native)
    - Dead code: 3 removed (lines X-Y, A-B, C) → nothing (unreachable)
    - Excessive complexity: 1 simplified (nested ternary at L42 → if/else)
    - Skipped (preserved): 2 (defensive null check at boundary; comment explaining WHY at L88)

Quality Gates:
  - Regression tests: PASS (12 tests, 0 failed)
  - Lint: PASS
  - Typecheck: PASS (0 new errors on changed files)
  - Unit/integration tests: PASS (45 tests, 0 failed)
  - Static/security scan: N/A (not configured)

Critical Review:
  - Safety: PASS
  - Behavior: PASS
  - Quality: PASS

Issues Found & Fixed:
  - [None] OR [Issue description → Fix applied]

Net Impact:
  - LOC: -74 (removed 91, added 17)
  - Dependencies: -1 (flatpickr removed; native <input type="date"> used)
  - Files deleted: 1

Remaining Risks / Deferred (this section is the debt ledger):
  - [None] OR [e.g., "boundary violation in module X flagged but not refactored — needs human judgment"]
  - debt: markers kept this pass: [None] OR [file:line — ceiling → upgrade trigger]

Final Status: CLEAN | ISSUES FIXED | REQUIRES ATTENTION
```

---

## Anti-Patterns (don't do these)

- **Skipping Phase 2.** Removing code on uncovered ground is a behavior-change time bomb regardless of how careful the work is. The regression test IS the safety mechanism; the checklist is its complement, not its replacement.
- **Bundling unrelated refactors.** A single "cleanup" commit with dead code deletion + abstraction removal + performance change is impossible to review or bisect. Stay scoped to slop.
- **Algorithm changes disguised as performance optimization.** If equivalence requires a proof, it's not a slop fix — it's a refactor and belongs in a separate change.
- **Silent skips.** If a quality gate is N/A, say so and why. Never claim PASS without evidence.
- **Removing comments that explain WHY.** "It's obvious from the code" is rarely true for the next reader. Only remove comments that restate WHAT.
- **Touching files outside scope.** If a file wasn't in the diff or explicit list, don't edit it, even if you notice slop in passing — report it under "Remaining Risks".

## Quality Assurance

- NEVER remove code that serves a functional purpose.
- ALWAYS verify changes compile/parse and pass type-check.
- ALWAYS preserve test coverage; add tests rather than remove them.
- If uncertain about a change, err on keeping the original code.
- The default when in doubt is SKIP, not GUESS.
