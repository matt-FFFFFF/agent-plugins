# skills/ast-grep — AGENTS.md

## OVERVIEW
A pinned vendor sync of [code-yeongyu/ast-grep-skill](https://github.com/code-yeongyu/ast-grep-skill) `@ 3148c69` (ast-grep CLI 0.45.0) — a single-file Python CLI wrapper plus reference docs. Parent: [`../../AGENTS.md`](../../AGENTS.md).

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| Upstream pin / sync policy | `SOURCE` (1 line) | `"Vendored as a sync; do not fork-drift."` |
| The wrapper itself | `scripts/ast_grep_helper.py` (748 lines) | Single-file, stdlib-only Python 3.9+ |
| Deep-dive docs (read in this order per SKILL.md) | `references/{patterns,pitfalls,recipes,cli,yaml-rules,sgconfig,install}.md` | Authoritative — don't duplicate content elsewhere |
| Tests | `tests/smoke.sh` + `tests/smoke.ps1` | Shell smoke tests, not pytest |
| Its own upstream license | `LICENSE` (MIT, code-yeongyu) | Don't remove |

## CONVENTIONS
- `scripts/ast_grep_helper.py` must stay **single-file, stdlib-only** — no pip deps, by explicit design.
- Binary resolution cascade (in `which_binary()`): cached `<skill_root>/bin/sg` → `@ast-grep/cli` via npm-on-PATH (with a Linux `setgroups`-collision workaround, since `sg` collides with `/usr/bin/sg`) → Homebrew → clear install-hint error. Don't reorder without re-checking the Linux collision handling.
- Subcommands (argparse, `build_parser()` at line 675): `search`, `replace`, `scan`, `test`, `new`, `langs`, `doctor`, `install`, `validate`. Exit codes are meaningful and documented in the module docstring (0 success, 1 arg error, 2 pattern-hint failure, 3 binary not found, 4 `sg` call failed, 5 timeout) — preserve them if you touch error paths.
- Offline pattern-hint validation runs **before** ever shelling out to `sg`, catching regex misuse (`\w`, `.*`, `|`, `[a-z]`) and language-specific incomplete patterns (e.g. Python trailing `:`, missing JS/Go/Rust function bodies).

## ANTI-PATTERNS
- **The `--json` + `--update-all` mutual exclusion is a real `sg` CLI quirk**, not a bug in this wrapper: `sg` silently ignores `--update-all` when `--json` is set. `cmd_replace` works around it with a two-pass approach (pass 1 `--json=compact` to collect matches, pass 2 `--update-all` to mutate) — any change here must preserve that two-pass structure, described in SKILL.md as "the single biggest gotcha."
- **Don't silently fork-drift.** Since this is a pinned vendor sync, treat any behavioral change to `ast_grep_helper.py`, `install.sh`, or `install.ps1` as an intentional fork — document it, don't just edit quietly. Prefer upstreaming a fix instead.
- Don't add a `.github/workflows/ci.yml` here expecting it to run — `README.md` describes upstream's own CI matrix, but that directory doesn't exist in this vendored copy (stripped on vendoring, or runs at a monorepo level this repo doesn't have).
