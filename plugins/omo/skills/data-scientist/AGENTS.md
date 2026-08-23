# skills/data-scientist — AGENTS.md

## OVERVIEW
DuckDB/Polars data-processing skill with an explicit, ordered decision tree for which engine to use — never pandas. Parent: [`../../AGENTS.md`](../../AGENTS.md).

## WHERE TO LOOK
| Task | Location |
|------|----------|
| Engine decision rule (11-branch ordered tree) | `SKILL.md` — apply top-to-bottom, first match wins |
| Benchmark evidence backing the decision rule | `references/performance-benchmarks.md` (h2oai db-benchmark suite) |
| ❌ NEVER / ✅ CORRECT pairs for DuckDB↔Polars handoff | `references/integration-patterns.md` |
| Ad-hoc query CLI | `scripts/quick-query.py` (`uv run --script`, PEP 723) |
| uv install/upgrade | `scripts/setup-uv.sh` (macOS/Linux/WSL) / `scripts/setup-uv.ps1` (native Windows) |

## CONVENTIONS
Decision tree (first match wins): `.duckdb` file → DuckDB · simple one-off query → DuckDB (direct file query) · heavy/complex SQL joins/window functions → DuckDB (optimizer) · filtering → Polars (fastest by a wide margin) · sorting → Polars · complex SQL joins → DuckDB (stronger join engine) · heavy GROUP BY → DuckDB · windowed functions w/ partitioning → Polars · complex transforms (pivot/melt/string ops) → Polars · dataset > RAM → Polars (streaming) or DuckDB (out-of-core) · mixed operations → hybrid, chain DuckDB→Polars→DuckDB.

`scripts/quick-query.py`: positional SQL arg routes to DuckDB; `--filter "expr"` routes to Polars via `pl.sql_expr` (**never** Python `eval`); `--describe` uses Polars `.describe()`. Supports CSV/Parquet/JSON/NDJSON; rejects Excel with a convert-first message.

## ANTI-PATTERNS (hard rules, stated as absolutes in SKILL.md)
- **Never use pandas** — the entire skill assumes it's absent; Polars/DuckDB beat it on every operation.
- **Always include numpy and pyarrow** in the execution environment — `.pl()` (DuckDB→Polars Arrow handoff) raises `ModuleNotFoundError` without `pyarrow`.
- **Never call `.df()`** on a DuckDB result (returns pandas, crashes without it) — always `.pl()`.
- **Always run via `uv run`**, never bare `python`/`python3`.
- Don't pre-load a file into Polars before a DuckDB direct-file query, and don't eager-load in Polars when `scan_*`/lazy would do — both are explicit ❌ NEVER entries in `references/integration-patterns.md`.
