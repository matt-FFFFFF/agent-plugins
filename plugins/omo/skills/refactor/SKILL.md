---
name: refactor
description: "Deterministic, codebase-aware refactoring workflow. Maps a definitive codemap and impact zones before touching anything, assesses test coverage to pick a verification strategy, plans with the Plan agent, then executes step by step with continuous lint/typecheck/test verification and commit checkpoints. Triggers: refactor, refactoring, cleanup, restructure, extract, simplify, modernize."
---

# Refactor

Intelligent, deterministic refactoring with full codebase awareness. Unlike blind search-and-replace, this:

1. **Understands intent** — classifies what's actually being asked before touching anything.
2. **Maps the codebase** — builds a definitive codemap before changing anything.
3. **Assesses risk** — evaluates test coverage and picks a verification strategy accordingly.
4. **Plans meticulously** — delegates to the `Plan` agent for a detailed, atomic-step plan.
5. **Executes precisely** — step by step, with `Edit`, the `ast-grep` skill, or CodeGraph-informed edits.
6. **Verifies constantly** — lint/typecheck/tests after every single step, zero exceptions.

## Usage

`/refactor <target> [--scope=file|module|project] [--strategy=safe|aggressive]`

`target` can be a file path, a symbol name, a pattern ("all functions using deprecated API"), or a description ("extract validation logic into its own module"). `--scope` defaults to `module`; `--strategy` defaults to `safe` (conservative, high test-coverage bar) vs `aggressive` (broader changes okay with adequate coverage).

---

## Phase 0: Intent Gate (mandatory first step)

| Signal | Classification | Action |
|---|---|---|
| Specific file/symbol | Explicit | Proceed to analysis |
| "Refactor X to Y" | Clear transformation | Proceed to analysis |
| "Improve", "clean up" | Open-ended | **Must ask**: "What specific improvement?" |
| Ambiguous scope | Uncertain | **Must ask**: "Which modules/files?" |
| Missing context | Incomplete | **Must ask**: "What's the desired outcome?" |

Before proceeding, confirm: target clearly identified, desired outcome understood, scope defined, success criteria articulable. If any is unclear, ask one clarifying question with your recommendation and options — don't guess.

Then create todos with `TodoWrite` for all six phases below, and mark each `in_progress` → `completed` as you go.

---

## Phase 1: Codebase Analysis (parallel exploration)

Fire several `Agent({subagent_type: "Explore", ...})` calls **in one message** so they run in parallel — one per angle:

1. Find all occurrences and definitions of the target — file paths, line numbers, usage patterns.
2. Find everything that imports, uses, or depends on the target — dependency chains, import graph.
3. Find similar patterns elsewhere in the codebase — analogous implementations, established conventions.
4. Find related test files — paths, test case names, coverage indicators.
5. Find the surrounding architecture — module boundaries, layer structure, design patterns in use.

**While those run**, work directly yourself:

- If the repo has a `.codegraph/` directory: `codegraph_explore`/`codegraph_callers`/`codegraph_callees`/`codegraph_impact` for precise definition/reference/impact analysis.
- Otherwise: `Grep`/`Glob` for text and structural patterns, and the `ast-grep` skill (`sg --pattern '...' --lang <lang>` or `python3 scripts/ast_grep_helper.py search`) for structural queries.
- `Grep` for straightforward text patterns.

Collect the `Explore` agents' results as their notifications arrive, then merge everything into one picture.

---

## Phase 2: Build the Codemap

From the merged Phase 1 findings, write:

```
## CODEMAP: <target>

### Core files (direct impact)
- path/to/file.ts:L10-L50 — primary definition
- path/to/file2.ts:L25 — key usage

### Dependency graph
<target>
├── imports from: module-a (types), module-b (utils)
├── imported by: consumer-1.ts, consumer-2.ts, consumer-3.ts
└── used by: handler.ts (direct call), service.ts (dependency injection)

### Impact zones
| Zone | Risk | Files affected | Test coverage |
|---|---|---|---|
| Core | HIGH | 3 files | 85% covered |
| Consumers | MEDIUM | 8 files | 70% covered |
| Edge | LOW | 2 files | 50% covered |

### Established patterns
- Pattern A: <description> — used in N places
```

From this, state explicit constraints: what MUST follow existing patterns, what MUST NOT break, what's safe to change freely, what requires a migration.

---

## Phase 3: Test Assessment

Detect the test infrastructure (`package.json` scripts, `pytest.ini`/`pyproject.toml`, `*_test.go`, etc.), then assess coverage for the target (which files cover it, what cases exist, integration tests, edge cases, a rough coverage estimate — an `Explore` agent can do this directly).

| Coverage | Strategy |
|---|---|
| HIGH (>80%) | Run existing tests after each step |
| MEDIUM (50-80%) | Run tests + add safety assertions |
| LOW (<50%) | **Pause** — propose adding tests first |
| NONE | **Block** — refuse aggressive refactoring until tests exist |

If coverage is LOW or NONE, present the risk and ask: add tests first (recommended), proceed with extra caution and manual verification, or abort.

Document the verification plan: exact test/typecheck/lint commands, the checkpoints to run after each step (lint/typecheck clean → tests pass → typecheck clean), and the specific regression indicators (tests that must keep passing, behavior/API contracts that must not change).

---

## Phase 4: Plan Generation

Delegate to the `Plan` agent with the codemap, verification plan, and these requirements: break down into atomic, independently-verifiable refactoring steps; order by dependency; specify exact files and line ranges per step; include a rollback strategy per step; define commit checkpoints.

Review the returned plan for completeness (every identified file addressed?), safety (each step reversible?), correct ordering, and that verification is specified per step. Then convert it into granular `TodoWrite` entries — one todo per implementation step, one paired verification todo per step.

---

## Phase 5: Execute (deterministic, step by step)

For each step, in order:

**Pre-step**: mark the todo `in_progress`, read the current file state, confirm the lint/typecheck baseline (so you can tell a new error from a pre-existing one).

**Execute** with the tool that fits:
- **Symbol renames**: find every usage with `Grep`/CodeGraph first, then apply the rename with `Edit` across every site — there's no atomic LSP rename here, so the verification step below is what actually catches a missed site.
- **Pattern transformations**: preview with `sg --pattern '...' --rewrite '...' --lang <lang> <path>` (or the ast-grep skill's helper), review the diff, then apply.
- **Structural changes**: `Edit` for precise, targeted changes.

**Post-step verification (mandatory, no exceptions)**:
1. Lint/typecheck on changed files — must be clean, or unchanged from baseline.
2. Run the relevant tests.
3. Type check the project if applicable.

If verification passes, mark the todo `completed`. If it fails: **stop**, revert the failed change, diagnose what broke, then either fix and retry, skip (if the step was optional), consult the `oracle` agent for a second opinion, or ask the user. **Never proceed to the next step with broken tests.**

After each logical group of steps, commit: `git commit -m "refactor(scope): description"` with a body explaining what changed and why.

---

## Phase 6: Final Verification (regression check)

Run the full test suite, a full type check, the linter, and the build (if applicable) — not just the files you touched. Re-check diagnostics on every changed file. Then produce a summary:

```
## Refactoring Complete

### What changed
- ...

### Files modified
- path/to/file.ts — what changed

### Verification results
- Tests: PASSED (X/Y)
- Type check: CLEAN
- Lint: CLEAN
- Build: SUCCESS

### No regressions detected
All existing tests pass. No new errors introduced.
```

---

## Critical rules

**Never**: skip the post-change lint/typecheck check; proceed with failing tests; change code without understanding its impact; use `as any`/`@ts-ignore`/`@ts-expect-error`; delete tests to make them pass; commit broken code; refactor without understanding existing patterns.

**Always**: understand before changing; preview structural rewrites before applying; verify after every single change; follow existing codebase patterns; keep todos current in real time; commit at logical checkpoints.

**Abort and consult the user if**: test coverage is zero for the target code, the change would break a public API, scope is genuinely unclear, three consecutive verification failures happen on the same step, or a user-defined constraint would be violated.

## Deprecated code & library migration

When a deprecated method/API surfaces during refactoring: fire the `librarian` agent to find the recommended modern alternative. Do NOT auto-upgrade to the latest version unless the user explicitly asked for a migration — if they did, use `librarian` to fetch the current API docs before making changes.

## Agents this skill uses

- `Explore` — parallel codebase pattern discovery (Phase 1).
- `Plan` — detailed refactoring plan generation (Phase 4).
- `oracle` — read-only consultation for hard architectural calls or a stuck verification failure.
- `librarian` — proactively, whenever a deprecated method or library migration comes up.

**Remember**: refactoring without tests is reckless. Refactoring without understanding is destructive. This workflow exists to ensure you do neither.
