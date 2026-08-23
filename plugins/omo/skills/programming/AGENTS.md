# skills/programming — AGENTS.md

## OVERVIEW
Multi-language (Python/Rust/TypeScript/Go) coding-conventions skill — the largest in the plugin (75 files, ~17.3k lines). SKILL.md: "This skill is an index. The hard per-language rules live under `references/`." Parent: [`../../AGENTS.md`](../../AGENTS.md).

## STRUCTURE
```
references/
├── {go,python,rust,typescript}/README.md + topic files   # per-language deep dives
├── rust-ub/            # loaded IN ADDITION to rust/ when touching unsafe/FFI/lock-free code
├── code-smells.md      # cross-cutting: 250-LOC ceiling, >3-param smell, size verdict table
└── logging.md          # cross-cutting: stack-agnostic logging methodology
scripts/{go,python,rust,typescript}/
├── check-no-excuse-rules.{py,sh,ts}   # text/AST-based AI-slop linters, one per language
└── new-project.py / new-project.ts / templates/   # scaffolders
```

## WHERE TO LOOK
| Task | Location |
|------|----------|
| Which reference to load for `.rs`/`.ts`/`.py`/`.go` | `SKILL.md` `## PHASE 0` language gate (run first, every time) |
| Topic-level routing within a language | `references/<lang>/README.md`'s own jump table (SKILL.md delegates this decision to it) |
| unsafe/FFI/lock-free Rust | `references/rust-ub/README.md` — load in ADDITION to `references/rust/`, never instead of |
| Adding/modifying a log line, logger, or service entrypoint | `references/logging.md` — Rule 0: discover the project's existing practice before emitting anything; never introduce a second logging framework |
| File-size / function-signature smells | `references/code-smells.md` |
| Run the slop linter for a language | `scripts/<lang>/check-no-excuse-rules.*` |
| Scaffold a new project or disposable script | `scripts/<lang>/new-project.*`, `scripts/python/new-script.py` |

## CONVENTIONS
- **250 pure LOC ceiling is a DEFECT above it** (not a suggestion) — measured via `awk '!/^[[:space:]]*$/ && !/^[[:space:]]*(\/\/|#|--)/' <file> | wc -l`. Verdict table: ≤200 healthy, 200–250 warning, >250 defect. Exceptions require `// allow: SIZE_OK — <reason>` (`# noqa: SIZE_OK` in Python). Even `check-no-excuse-rules.py` itself carries this exemption on line 6.
- **>3 function parameters is a smell** — includes closing the `dict`/`Record<string,unknown>`/`map[string]any`/`**kwargs`/`...args` workaround loophole.
- Test speed budgets: unit <10ms each / integration <1s each; suite budgets: unit <30s total / integration <5min total.
- Each language's slop linter follows the same design principle (stated in the Go one's header): "only rules enforceable via pure text matching live here — everything semantic is on the real toolchain" (clippy+miri / golangci-lint+nilaway / tsc). Python's is AST/token-based (14 rules incl. `no-pandas`, `oversized-module`, `missing-assert-never`); Rust has both a bash and a Python rewrite; TypeScript's is a Bun script with its own regression test suite (`check-no-excuse-rules.test.ts`) — notably that suite asserts the checker resolves `typescript` from the *caller's* cwd, not its own install path, so it works from a cached skill install against an arbitrary project checkout.
- Disposable-script ergonomics matter as much as production code: `uv run` + PEP 723 (Python), `rust-script` w/ inline `Cargo.toml` (Rust), `bun run` (TypeScript), `//go:build ignore` + `go run` (Go) — "even one-off scripts get the full treatment."

## ANTI-PATTERNS
- Don't skip `references/rust-ub/` when a Rust change touches `unsafe`, raw pointers, `MaybeUninit`, FFI, `unsafe impl Send/Sync`, or a custom lock-free primitive — it's an escalation, not an alternative to `references/rust/`.
- Don't add a `# noqa`/`// allow` size exemption without a reason — the whole point of the ceiling is that files this size stop fitting on one screen.
- Don't introduce a second logging framework into a project without checking `references/logging.md` Rule 0 first.
