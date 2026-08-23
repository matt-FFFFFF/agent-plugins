# skills/debugging — AGENTS.md

## OVERVIEW
Pure reference-router skill (no scripts) for runtime debugging — hypothesis-driven methodology plus per-runtime and per-tool reference docs. SKILL.md states its own limits: "This file is a map. **The knowledge is in `references/`.**" Parent: [`../../AGENTS.md`](../../AGENTS.md).

## STRUCTURE
```
references/
├── methodology/   # 9 files, one per numbered phase (00-setup.md ... 09-cleanup.md),
│                  #   plus 03-flaky-triage.md and partial-runtime-evidence.md (situational, not sequential)
├── runtimes/      # 6 files, one per language/runtime: python, node (covers tsx/Bun/Deno too),
│                  #   rust, go, native-binary.md, bundled-js-binary.md
└── tools/         # 4 files, one per specialist tool: playwright-cli, ghidra, pwndbg, pwntools
```

## WHERE TO LOOK
| Task | Location |
|------|----------|
| The phase-by-phase methodology | `references/methodology/0N-*.md`, mirrored 1:1 by the phase table in SKILL.md |
| A failure that won't reproduce every run | `references/methodology/03-flaky-triage.md` — read BEFORE Phase 2 |
| Can't run the actual operation | `references/methodology/partial-runtime-evidence.md` |
| Attach/inspect a specific runtime | `references/runtimes/<lang>.md` — distinguish native vs. bundled-JS binaries via `du -h` + `strings` heuristic in SKILL.md |
| Browser QA, decompiler, native-binary tooling | `references/tools/*.md` — mandatory-when-in-domain, not optional |

## CONVENTIONS (the methodology, high level)
- Two disciplines regardless of runtime: **runtime state is the only source of truth** (never fix a guessed cause from reading code alone), and **leave no trace** (every debug artifact journaled and reverted before declaring done).
- Hypothesis-driven loop: form ≥3 hypotheses across orthogonal axes, investigate in parallel (team mode or async subagents).
- Escalation ladder: after 2 consecutive failed hypothesis rounds, spawn an "Oracle Triple" (three `oracle` agents, orthogonal framings, synthesized) — escalation is for genuine ambiguity, not a shortcut past investigation.
- Root cause counts as confirmed only when toggling the suspected cause toggles the bug, then a strict TDD fix follows: red test first, minimal green, no scope expansion.
- "Done" means actually using the system as the user would (tmux for CLI, Playwright for browser, real curl for API), not type-check/compile passing.
- **Gate rule**: before running a command from a given reference's domain, you must have read that reference in this session — applies to runtime references before attaching a debugger and tool references before use.

## ANTI-PATTERNS
- **Never ship a fix without a failing-first test.**
- **Never declare done on type-check/compile alone.**
- **Never `git commit` from inside this skill** — commits belong to `git-master` after the user confirms.
- Don't skip straight to Phase 4 (Oracle Triple) to avoid doing the investigation — it's gated behind 2 failed rounds specifically to prevent this.
