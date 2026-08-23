# skills/frontend — AGENTS.md

## OVERVIEW
A 4-ruleset router skill (design / perfection / ui-ux-db / designpowers) plus curl-only research recipes (lazyweb, beui.dev). SKILL.md is explicit: "This file is a router, not a rulebook." The largest and most heavily vendored skill in the plugin. Parent: [`../../AGENTS.md`](../../AGENTS.md).

## STRUCTURE
```
SKILL.md               # router only — Phase 0 table, 4 numbered branches, per-ruleset file tables
ATTRIBUTION.md          # 4 upstreams, each a pinned git submodule in the SOURCE monorepo (not here)
LICENSE-Apache-2.0.txt
references/
├── design/            # 11 files present (project-original "Layer 0" only)
├── perfection/         # README.md + react-perf-tooling.md — real-browser-only performance audits
└── designpowers/       # 9 files, internal ruleset ("not a standalone skill" per its own frontmatter)
scripts/perfection/lighthouse-audit.py   # uv run --script, drives real Chrome via Playwright CDP
```

## ⚠️ Vendoring gap — READ BEFORE routing to a "missing" file
`ATTRIBUTION.md` documents 4 upstream submodules (`nexu-io/open-design`, `Leonxlnx/taste-skill`, `nextlevelbuilder/ui-ux-pro-max-skill`, `Owl-Listener/designpowers`) materialized into `references/{design,ui-ux-db,designpowers/vendor}/` **only at build/npm-pack time**, from `packages/shared-skills/upstreams/` in the source monorepo. **None of that exists in this checkout** — no `.gitmodules`, no `references/ui-ux-db/` at all, no `references/design/<brand>.md` beyond the 11 project-original files, no `designpowers/vendor/`. `.gitignore` whitelists exactly the project-original files; `.npmignore` exists specifically to defeat that `.gitignore` at publish time so the materialized files ship in the npm tarball.

**Practical implication**: SKILL.md routes to `ui-ux-db/README.md` and 70 `design/<brand>.md` brand files that simply are not present here. Don't "fix" this by deleting the routing table — it's correct for the published package. If a task actually needs one of those files, say so explicitly rather than silently treating the route as broken; they only exist post-materialization.

## WHERE TO LOOK
| Task | Location |
|------|----------|
| Which ruleset applies | `SKILL.md` — `## Phase 0 — Route` table + "Quick routes" table (~13 canned request→file-set mappings) |
| Design system gate (must exist before any UI work) | `references/design/README.md` — `DESIGN.md` 8-section structure defined in `references/design/design-system-architecture.md` |
| Performance/Lighthouse audits | `references/perfection/README.md` + `scripts/perfection/lighthouse-audit.py` |
| Interaction patterns (curl-only, never from memory) | `references/design/interaction-skill.md` (beui.dev) |
| Real shipped-product screenshot research | `references/design/lazyweb.md` (curl-only, cached bearer token at `~/.lazyweb/lazyweb_mcp_token`) |
| designpowers phase lanes | `references/designpowers/{lane-a-direction,lane-b-execution,lane-c-review,lane-d-memory}.md` |

## CONVENTIONS
- `lighthouse-audit.py` launches real Chrome via Playwright CDP and shells an embedded Node snippet to `lighthouse` — **never** the bare `lighthouse` CLI. Runs mobile + desktop presets, exits non-zero below `--threshold` (default 100).
- 7 shared axioms across all 4 rulesets (SKILL.md): no `DESIGN.md` = no UI work · a concrete visual reference is a contract · never weaken UX for Lighthouse points · no emoji icons · GPU-composited animation only · slop-animation ban · `/visual-qa` is the completion gate, not self-assessment.
- `references/designpowers/lane-c-review.md` is mandatory before any implementation reaches "Phase Final" — requires `/visual-qa` evidence first.

## ANTI-PATTERNS
- Don't try to edit `references/design/<brand>.md` for a brand outside the 11 present files, or anything under `ui-ux-db/`/`designpowers/vendor/` — those paths need to be changed upstream and re-pinned by commit hash, not edited here.
- Note: `ATTRIBUTION.md` and `references/design/_INDEX.md` disagree on Layer B's actual upstream source (`nexu-io/open-design` vs. `VoltAgent/awesome-design-md`) — flag this rather than picking one silently if it matters to a task.
