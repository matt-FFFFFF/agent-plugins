# Notice

**This software has been modified from its original source.** The planning workflow, agent prompts, references and scripts in this plugin originate from [oh-my-openagent](https://github.com/code-yeongyu/oh-my-openagent) (npm: `oh-my-opencode`), copyright YeonGyu-Kim, licensed under the Sustainable Use License v1.0 (full text in `LICENSE.md`, alongside this file).

oh-my-openagent is a multi-agent framework built on top of OpenCode. This plugin ports only its planning path (the OpenCode Prometheus agent and the `ulw-plan` skill, plus the research and review agents they delegate to) so Claude Code can produce `.omo/plans/<slug>.md` files that oh-my-openagent's executor runs unchanged. Every source below comes from the OpenCode codepath, not the Senpi or Codex packages.

## Sources (OpenCode codepath only)

Paths on the right are relative to the oh-my-openagent repository root.

| File in this plugin | Upstream source |
| --- | --- |
| `skills/plan/SKILL.md` | `packages/shared-skills/skills/ulw-plan/SKILL.md` |
| `skills/plan/references/*.md` | `packages/shared-skills/skills/ulw-plan/references/*.md` |
| `skills/plan/scripts/plan-templates.mjs` | `packages/shared-skills/skills/ulw-plan/scripts/plan-templates.mjs` |
| `skills/plan/scripts/scaffold-plan.mjs` | `packages/shared-skills/skills/ulw-plan/scripts/scaffold-plan.mjs` |
| `skills/plan/scripts/check-plan.mjs` | Original to this plugin; parsing regexes copied from `packages/boulder-state/src/plan-checklist.ts` and `packages/boulder-state/src/markdown-fence.ts` |
| `agents/planner.md` | Prometheus (Plan Builder), `packages/prompts-core/prompts/prometheus/default.md` |
| `agents/codebase-explorer.md` | explore, `packages/omo-opencode/src/agents/explore.ts:40-116` |
| `agents/docs-researcher.md` | librarian, `packages/omo-opencode/src/agents/librarian.ts` (prompt string from line 40 to its closing backtick) |
| `agents/gap-analyst.md` | Metis (Plan Consultant), `packages/omo-opencode/src/agents/metis.ts:23-294` |
| `agents/plan-critic.md` | Momus (Plan Critic), `packages/omo-opencode/src/agents/momus.ts:26-202` (`MOMUS_DEFAULT_PROMPT` only) |
| `agents/plan-auditor.md` | oracle, `packages/omo-opencode/src/agents/oracle.ts:44-164` (`ORACLE_DEFAULT_PROMPT` only) |
| `hooks/planner-guard.mjs` | `packages/omo-opencode/src/hooks/prometheus-md-only/{constants,path-policy,hook}.ts` |

## Persona to function-name map

Identifiers in this plugin name what each component does. Upstream persona names appear only in descriptions, the README agents table and this file.

| Upstream persona | Identifier here |
| --- | --- |
| Prometheus | `omo-planner:planner` |
| explore | `omo-planner:codebase-explorer` |
| librarian | `omo-planner:docs-researcher` |
| Metis | `omo-planner:gap-analyst` |
| Momus | `omo-planner:plan-critic` |
| oracle | `omo-planner:plan-auditor` |

## What was changed

- Execution machinery removed: no start-work, Atlas, Sisyphus, Hephaestus, boulder state, loops or notepads. This plugin writes plans and never executes them.
- Senpi and Codex specific text removed.
- Delegation rewritten for Claude Code: research and review go through the `Agent` tool, the workflow loads through the `Skill` tool, and interview questions use `AskUserQuestion`.
- The descriptor-chain review intake was replaced by `check-plan.mjs --digest` (lstat no-symlink chain plus a sha256 of the bytes read).
- The `git` task category was removed, since it isn't an OpenCode built-in. Plans use only OpenCode's 9 built-in categories.
- The planner is restricted to the main thread (`claude --agent omo-planner:planner`) and can't be spawned as a subagent.

## What this plugin adds

The plugin packaging (`.claude-plugin/plugin.json`), this file, `check-plan.mjs` and the `planner-guard` tests are original to this plugin. The marketplace packaging one level up (`.claude-plugin/marketplace.json`) is original to the `agent-plugins` repository.

## Full upstream license

See `LICENSE.md` for the complete Sustainable Use License v1.0 text that governs this plugin, matching the license oh-my-openagent uses for this content.
