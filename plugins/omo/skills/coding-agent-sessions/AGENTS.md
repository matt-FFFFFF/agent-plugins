# skills/coding-agent-sessions — AGENTS.md

## OVERVIEW
First-party (not vendored — no `SOURCE`/upstream pin) Python package that finds/reads local session transcripts across 26 coding-agent platforms (Codex, Claude Code, OpenCode, Cursor CLI, Aider, etc.). Entry point: `scripts/find-agent-sessions.py list|find|search|read|get`, JSON output. Parent: [`../../AGENTS.md`](../../AGENTS.md).

## STRUCTURE
```
scripts/
├── find-agent-sessions.py     # 19-line shim → runpy into agent_sessions.cli
├── agent_sessions/
│   ├── cli.py                 # real main(): manual argv parsing, dispatches list/search/get
│   ├── scanners.py            # THE EXTENSION POINT — PLATFORM_SCANNERS registry, scan()
│   ├── types.py                # Session (frozen dataclass) + Options
│   ├── transcript.py, jsonio.py, timeparse.py   # shared scan primitives
│   └── {claude,codex,opencode,pi_family,file_scanners,sqlite_scanners,
│         sqlite_optional_scanners,kiro_scanner,aside_scanner}.py   # per-platform scan_<platform>()
└── tests/   # pytest, PEP 723 inline deps, no conftest.py/pyproject.toml
```

## WHERE TO LOOK
| Task | Location |
|------|----------|
| Add support for a new agent platform | See EXTENSION POINT below |
| Understand a specific platform's storage layout | `references/{codex,claude,opencode,senpi,all-platforms}.md` |
| Run tests | `uv run --with pytest pytest scripts/tests/ -v` |

## EXTENSION POINT — adding a new platform
1. Write `scan_<platform>(extra_roots: tuple[Path, ...], workers: int) -> list[Session]` — in `file_scanners.py` for flat JSONL, `sqlite_scanners.py`/`sqlite_optional_scanners.py` for SQLite-backed, or a new module for anything unusual (see `aside_scanner.py` for a SQLite-index-over-JSONL example).
2. Register it in `scanners.py`'s `PLATFORM_SCANNERS` dict; add to `PLATFORM_ALIASES` if it needs a short alias.
3. Populate `Session.parent_id`/`agent` correctly — the dedupe logic in `scanners._dedupe`/`_linkage_score` prefers sessions with richer subagent linkage.
4. Add a test in `scripts/tests/` (temp-dir fixture → call scanner → assert on `Session` fields), following e.g. `test_pi_family_scanners.py`.
5. Update SKILL.md's `## PHASE 0 - PLATFORM ROUTER` table and the platform list in its frontmatter `description`; add a `references/*.md` file if the storage layout is nontrivial.

## CONVENTIONS
- Every scanner has the exact signature `(extra_roots: tuple[Path, ...], workers: int) -> list[Session]` — this is the `Scanner` type alias in `scanners.py`. Don't deviate.
- Tests use PEP 723 inline script metadata (`# /// script ... dependencies = ["pytest"] ///`) rather than a shared `pyproject.toml`/`conftest.py` — each test file does its own `sys.path.insert`. Follow this pattern for new test files, don't introduce a `conftest.py`.
- No upstream-sync constraint (unlike `ast-grep`) — this package is original to this repo, normal edit flow applies.

## ANTI-PATTERNS
- Don't add a shared `__init__.py` re-export surface — `scripts/agent_sessions/__init__.py` is intentionally near-empty; consumers import submodules directly.
- Don't hand-roll argv parsing changes without checking `cli.py` — it does NOT use `argparse` (manual parsing), so error-message/flag conventions must match the existing style by hand.
