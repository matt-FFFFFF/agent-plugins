# omo-planner KNOWLEDGE BASE

## OVERVIEW
Planning-only Claude Code plugin ported from oh-my-openagent's OpenCode planning path (`ulw-plan` skill + Prometheus agent + the research/review agents they delegate to). It writes `.omo/drafts/<slug>.md` and `.omo/plans/<slug>.md` that OMO's `/ulw-execute` runs unchanged in OpenCode. No execution machinery. Version `0.1.0`. Licensed under the Sustainable Use License v1.0 (free non-commercial redistribution only).

## STRUCTURE
```
plugins/omo-planner/
├── .claude-plugin/plugin.json
├── LICENSE.md
├── NOTICE.md
├── README.md
├── AGENTS.md
├── agents/planner.md
├── agents/codebase-explorer.md
├── agents/docs-researcher.md
├── agents/gap-analyst.md
├── agents/plan-critic.md
├── agents/plan-auditor.md
├── hooks/hooks.json
├── hooks/planner-guard.mjs
├── hooks/tests/planner-guard.test.mjs
└── skills/plan/
    ├── SKILL.md
    ├── references/full-workflow.md
    ├── references/intent-clear.md
    ├── references/intent-unclear.md
    ├── scripts/plan-templates.mjs
    ├── scripts/scaffold-plan.mjs
    ├── scripts/check-plan.mjs
    └── scripts/tests/{scaffold-plan.test.mjs,check-plan.test.mjs,fixtures/valid-plan.md}
```

## WHERE TO LOOK
| Task | Location | Notes |
| --- | --- | --- |
| Workflow text (opening, routing, approval gate, delegation, stop rules) | `skills/plan/SKILL.md` + `skills/plan/references/` | `full-workflow.md` holds shared mechanics: classification, template, review intake/lifecycle/convergence |
| Draft and plan templates | `skills/plan/scripts/plan-templates.mjs` | `buildDraft`, `buildPlanSkeleton`, `PLAN_SECTION_HEADERS`, `FINAL_VERIFICATION_ITEMS` |
| Artifact creation CLI | `skills/plan/scripts/scaffold-plan.mjs` | Resume-safe; `--draft-only`, `--review-required`, `--reset [--force]`; self-guards writes to `.omo/` |
| Plan format rules | `skills/plan/scripts/check-plan.mjs` | Rules R0-R12; exit 0/1/2/64; `--digest`/`--json` in any position |
| Write boundary | `hooks/planner-guard.mjs` (wired in `hooks/hooks.json`) | `decide()` and `isAllowedFile()` are exported for tests |
| Agent prompts | `agents/*.md` | Planner body is thin; the workflow lives in the skill |
| Provenance | `NOTICE.md` | Upstream source per file, persona map, change list |

## CONVENTIONS
- **Agent frontmatter.** Research/review agents (`codebase-explorer`, `docs-researcher`, `gap-analyst`, `plan-critic`, `plan-auditor`) use keys `name`, `description`, `model`, optional `effort`, and a `disallowedTools: Write, Edit, MultiEdit, NotebookEdit, Agent` denylist, not `tools`, so they keep MCP read tools. The planner uses a `tools` allowlist ending in `Agent(omo-planner:codebase-explorer, omo-planner:docs-researcher, omo-planner:gap-analyst, omo-planner:plan-critic, omo-planner:plan-auditor)`.
- **`description:` is always a YAML double-quoted string** (inner `"` escaped). An unquoted `(upstream: X)` is a YAML error, and Claude Code then ignores every frontmatter field.
- **Skill frontmatter has 2 keys:** `name`, `description`.
- **Script paths in Markdown bodies use `${CLAUDE_PLUGIN_ROOT}`**, e.g. `node "${CLAUDE_PLUGIN_ROOT}/skills/plan/scripts/check-plan.mjs"`.
- **Node built-ins only.** No package.json, no npm dependencies. Scripts run under `node` or `bun`; the hook command is `node`.
- **Review intake.** Both review lanes echo `workspace_root`, `runtime_home` (always `null`), `target`, `artifact_identity`, `round_identity` and `launch_identity`; the plan digest comes from `check-plan.mjs --digest`.
- **Tests**, from the repo root (quote the globs; Node >= 21 doesn't expand bare directories):
  ```
  node --test "plugins/omo-planner/skills/plan/scripts/tests/*.test.mjs" "plugins/omo-planner/hooks/tests/*.test.mjs"
  ```
- **Version** lives in `.claude-plugin/plugin.json` and is mirrored in the root `.claude-plugin/marketplace.json`. Bump both by hand.

## RE-PORTING UPSTREAM
Upstream repo: oh-my-openagent (`U` below). Paths are relative to `U`; `S` = `packages/shared-skills/skills/ulw-plan`; OpenCode codepath only, never Senpi or Codex packages.

| File here | Upstream source |
| --- | --- |
| `skills/plan/SKILL.md` | `S/SKILL.md` |
| `skills/plan/references/full-workflow.md` | `S/references/full-workflow.md` |
| `skills/plan/references/intent-clear.md` | `S/references/intent-clear.md` |
| `skills/plan/references/intent-unclear.md` | `S/references/intent-unclear.md` |
| `skills/plan/scripts/plan-templates.mjs` | `S/scripts/plan-templates.mjs` |
| `skills/plan/scripts/scaffold-plan.mjs` | `S/scripts/scaffold-plan.mjs` |
| `skills/plan/scripts/check-plan.mjs` | Original; regexes from `packages/boulder-state/src/plan-checklist.ts` and `packages/boulder-state/src/markdown-fence.ts` |
| `agents/planner.md` | `packages/prompts-core/prompts/prometheus/default.md` (upstream: Prometheus) |
| `agents/codebase-explorer.md` | `packages/omo-opencode/src/agents/explore.ts:40-116` |
| `agents/docs-researcher.md` | `packages/omo-opencode/src/agents/librarian.ts:40-` (to the prompt's closing backtick) |
| `agents/gap-analyst.md` | `packages/omo-opencode/src/agents/metis.ts:23-294` |
| `agents/plan-critic.md` | `packages/omo-opencode/src/agents/momus.ts:26-202` (`MOMUS_DEFAULT_PROMPT` only) |
| `agents/plan-auditor.md` | `packages/omo-opencode/src/agents/oracle.ts:44-164` (`ORACLE_DEFAULT_PROMPT` only) |
| `hooks/planner-guard.mjs`, `hooks/hooks.json` | `packages/omo-opencode/src/hooks/prometheus-md-only/{constants,path-policy,hook}.ts` |
| Planning-context block in `SKILL.md` | `packages/omo-opencode/src/hooks/prometheus-md-only/constants.ts:23-44` |

Substitution table, applied to every ported text file:

| Upstream text | Replace with |
| --- | --- |
| `skill(name="ulw-plan")`, "the ulw-plan skill" | the `omo-planner:plan` skill (Skill tool) |
| "Prometheus" as the actor's self-name | "the planner" (first mention may add "(upstream: Prometheus)") |
| `task(subagent_type="explore", ...)` / explorer | `Agent` tool, `subagent_type: "omo-planner:codebase-explorer"` |
| librarian | `omo-planner:docs-researcher` |
| metis / Metis | `omo-planner:gap-analyst` |
| native `momus` / Momus | `omo-planner:plan-critic` |
| independent Oracle review / `oracle` | `omo-planner:plan-auditor` |
| `node "<skill-root>/scripts/scaffold-plan.mjs"` | `node "${CLAUDE_PLUGIN_ROOT}/skills/plan/scripts/scaffold-plan.mjs"` |
| `question` tool | `AskUserQuestion` tool |
| `$ulw-execute` | `/ulw-execute` run by the user in OpenCode with oh-my-openagent installed (outside Claude Code; this plugin never executes) |
| "Never dispatch with `category=`" | "Never spawn any agent except the five omo-planner research/review agents (no general-purpose, no Plan, no built-in Explore)" |
| background_output / timeout back-off text | "Fire independent Agent calls in ONE message; long reviews may use `run_in_background: true` and arrive as notifications; never cancel a running reviewer for elapsed time alone" |
| openat/descriptor-chain read mechanism, `runtime_home` | `node "${CLAUDE_PLUGIN_ROOT}/skills/plan/scripts/check-plan.mjs" --digest .omo/plans/<slug>.md` (lstat no-symlink chain + sha256 of the bytes read); `runtime_home` is always `null` |
| category vocabulary containing `git` | the 9 OpenCode built-ins: `quick`, `unspecified-low`, `unspecified-high`, `visual-engineering`, `artistry`, `writing`, `deep-low`, `deep-high`, `ultrabrain` (git work -> `quick`) |
| Senpi, Codex, `omo-agent-toolkit`, `ulw-loop`, `attemptDir`, `team_*`, hyperplan, `call_omo_agent`, `--draft-only` evidence prose about attempt dirs | delete the sentence/clause |
| `<attemptDir>/task-<N>-<slug>.<ext>` | `.omo/evidence/<slug>/task-<N>-<label>.<ext>` |

Sync rules:
- Keep the check-plan regexes in sync with `packages/boulder-state/src/plan-checklist.ts` (and the fence helpers with `markdown-fence.ts`).
- Keep `PLAN_SECTION_HEADERS` and `FINAL_VERIFICATION_ITEMS` identical to upstream.
- Re-derive the category list from `packages/omo-opencode/src/tools/delegate-task/*-categories.ts`, then update `CATEGORIES` in `check-plan.mjs`, the template text and `SKILL.md` together.

## ANTI-PATTERNS
- Never add execution components (start-work, Atlas, Sisyphus, Hephaestus, boulder state, loops, notepads, an `**Agent**:` field). This plugin writes plans only.
- Never add the `git` or legacy `deep` category, and never add a per-todo skills / `load_skills` field.
- Never let the planner run as a subagent. planner-guard denies the spawn; don't weaken that.
- Never give research/review agents write tools or `Agent`.
- Never add `hooks`, `permissionMode` or `mcpServers` to agent frontmatter. Claude Code ignores them for plugin agents.
- Never remove or obscure license or notice text in `LICENSE.md` / `NOTICE.md`.
