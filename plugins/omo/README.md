# omo

A roster of 10 Claude Code subagents and 14 skills adapted from [oh-my-openagent](https://github.com/code-yeongyu/oh-my-openagent) — see `NOTICE.md` for exactly what was changed, and `LICENSE.md` for the terms this plugin is distributed under (free, non-commercial redistribution only, attribution required).

## Recommended companion tools (optional)

Nothing here requires any of them — every agent, skill, and hook degrades gracefully without them. But three tools meaningfully improve what this plugin can do, and a one-time `SessionStart` hook (`hooks/session-start.sh`) will mention whichever ones are missing the first time you use this plugin, then stay silent:

- **[CodeGraph](https://github.com/colbymchenry/codegraph)** — the `Explore` agent and the `init-deep`/`ulw-plan`/`refactor` skills all reach for the `codegraph_explore` MCP tool first when it's present, for faster and more accurate code navigation than grep/glob alone.
  ```
  curl -fsSL https://raw.githubusercontent.com/colbymchenry/codegraph/main/install.sh | sh
  ```
- **[caveman](https://github.com/JuliusBrussee/caveman)** — `ulw-research`, `ulw-plan`, and `init-deep` all fan work out to several subagents at once; caveman compresses that traffic before it lands back in your main context, which can cut token usage meaningfully on those workflows.
  ```
  npm install -g @caveman-ai/cli && caveman setup --install
  npx skills add JuliusBrussee/caveman
  ```
- **[comment-checker](https://github.com/code-yeongyu/go-claude-code-comment-checker)** — a `PostToolUse` hook (`hooks/comment-checker.sh`) pipes every `Write`/`Edit`/`MultiEdit` through it to block AI-slop comments (restated logic, filler phrases, dead TODOs, commented-out code) before they land in the file.
  ```
  npm install -g @code-yeongyu/comment-checker
  ```

## Agents (`agents/`)

| Agent | Model | Role |
|---|---|---|
| `Explore` | haiku | Fast contextual grep for codebases (overrides Claude Code's built-in `Explore`) |
| `librarian` | haiku | External docs / OSS research, GitHub-permalink evidence |
| `metis` | opus | Pre-planning consultant — surfaces hidden intent, ambiguity, AI-slop risk |
| `momus` | opus | Practical plan reviewer — approves by default, blocks only on real gaps |
| `oracle` | opus | Deep-reasoning strategic advisor for hard debugging/architecture calls |
| `sisyphus-junior` | sonnet | Junior counterpart to `sisyphus` — single bounded task, same discipline scaled down, verifies once, stops |
| `prometheus` | opus | Explore-first planner — spawns research subagents, writes a decision-complete plan, never implements; the isolated-context form of the `ulw-plan` skill |
| `atlas` | sonnet | Plan orchestrator — delegates each todo to `omo:sisyphus`/`omo:sisyphus-junior`, validates the evidence, updates the plan, commits per its commit strategy; the isolated-context form of the `start-work` skill |
| `hephaestus` | opus | Autonomous deep worker for hard, open-ended goals |
| `sisyphus` | opus | General-purpose implementation workhorse — the senior counterpart to `sisyphus-junior` |

Most of these stay leaves by choice — simpler and cheaper, no recursion to reason about. The two exceptions are `prometheus` and `atlas`: they carry the `Agent` tool and delegate exactly as their paired skills (`ulw-plan`, `start-work`) do — `prometheus` fans research out to `omo:Explore`/`omo:librarian`/`omo:metis`, `atlas` fans implementation out to `omo:sisyphus`/`omo:sisyphus-junior` — the difference from the skills being that the agent runs sealed off in its own context and hands back a summary. Claude Code supports nested subagent delegation up to a depth limit; this roster just doesn't use it anywhere else.

## Skills (`skills/`)

- **Portable, close to verbatim**: `ast-grep`, `frontend`, `coding-agent-sessions`, `debugging`, `ultimate-browsing`, `data-scientist`, `git-master`, `programming`.
- **Adapted with real delegation**: `init-deep` (hierarchical `AGENTS.md` generation via parallel `Explore` agents + CodeGraph), `ulw-plan` (Prometheus-style planning that delegates to `Explore`/`librarian`/`metis`/`momus`/`oracle`), `refactor` (codemap-driven refactor via `Explore` + the `Plan` agent), `remove-ai-slops` (10-category AI-slop cleanup via `sisyphus-junior`), `ulw-research` (maximum-saturation research swarm with an EXPAND lead-chasing loop and verify-by-running-code), `start-work` (grinds a plan/checklist file to completion by delegating each item to `sisyphus`/`sisyphus-junior` per the plan's `Agent` field — runs inline in your conversation; the `atlas` agent is the same workflow sealed off in its own context).

## Why these exist

oh-my-openagent is its own multi-agent coding framework (built on OpenCode) with a delegation system, state directories, and tool surface that don't exist in Claude Code. Nothing here is a straight copy — every file was rewritten to drop that framework-specific machinery while keeping the underlying prompts, discipline, and methodology. Full provenance is in `NOTICE.md`.

## How to use

**Skills are the front door.** They activate on their trigger phrases (each `SKILL.md` frontmatter lists them) or you can invoke one by name. Most of the day-to-day value is here, not in manually picking an agent:

- Starting something non-trivial and want a plan first → say **"ulw-plan"** or "plan this". It interviews you only where it has to, then writes a decision-complete plan and delegates review to `metis`/`momus`/`oracle` for you.
- Want a codebase-wide `AGENTS.md` knowledge base → **"init-deep"**.
- Refactoring with real risk of breaking something → **"refactor `<target>`"**.
- Cleaning up AI-generated code smell on a branch → **"remove ai slops"**.
- Need exhaustive, cited research (not a quick question) → **"ulw-research `<topic>`"**.
- Have a plan/checklist file ready to execute end-to-end, unattended → **"start-work"**. It delegates each item to `sisyphus` or `sisyphus-junior` per the plan's `Agent` field and won't stop to ask between items.
- Everyday coding conventions (Python/Rust/TypeScript/Go), git hygiene, debugging methodology, data work, frontend/design work, structural code search — the portable skills (`programming`, `git-master`, `debugging`, `data-scientist`, `frontend`, `ast-grep`) mostly trigger themselves from context; you rarely need to name them.

**Reach for an agent directly when you want to delegate a whole unit of work out of your current context**, not just load methodology into it. Rule of thumb, cheapest-fitting first:

1. **Just need to find something** (a file, a symbol, "where is X handled") → `Explore`. It's on haiku — fire several in parallel, they're cheap.
2. **Need external/library research** (docs, GitHub examples, "how does library Y actually behave") → `librarian`.
3. **Have a bounded, well-scoped task** ("fix this one function", "add this one endpoint") → `sisyphus-junior`. It executes, verifies once, and stops — don't reach for something heavier. `sisyphus`/`sisyphus-junior` are now a senior/junior pair with the same underlying discipline; `start-work` and `ulw-plan` pick between them automatically, but you can reach for either directly too.
4. **Have a genuinely hard, open-ended, or ambiguous goal** ("make search faster", "figure out why this leaks memory") → `hephaestus`. Give it the goal, not the steps — it explores exhaustively before acting and won't stop early.
5. **General implementation work that's bigger than sisyphus-junior but doesn't need hephaestus's exhaustive autonomy** → `sisyphus`. This is the reasonable default when in doubt.
6. **Have a whole plan file to drive start-to-finish in one sealed context** → `atlas`. It's the plan orchestrator: delegates each todo to `omo:sisyphus`/`omo:sisyphus-junior`, validates the evidence itself, updates the plan file, and commits per the plan's `## Commit strategy` — auto-continuing between items. Same workflow as the `start-work` skill; reach for the skill when you'd rather it run inline in your current conversation.
7. **Before committing to an approach on something risky** → `metis` (surfaces what you haven't thought about) and/or `oracle` (a second opinion from a strong reasoning model) *before* you implement, not after.
8. **Reviewing a plan someone else (or `prometheus`) wrote** → `momus`. It's biased toward approving — it's a blocker-finder, not a perfectionist, so don't expect nitpicks.

**A typical end-to-end flow**: `ulw-plan` (or the `prometheus` agent directly, if you want it isolated from your main conversation) → the **`start-work`** skill executes the resulting plan (or the `atlas` agent to execute it in one sealed context, or `sisyphus`/`sisyphus-junior` directly for a single task) → `remove-ai-slops` on the branch before opening a PR. For a single hard problem instead of a multi-step plan, skip straight to `hephaestus`.

**Cost awareness**: `Explore`/`librarian` are on `haiku` — cheap, use them liberally for research. `atlas`/`sisyphus-junior` are on `sonnet`. Everything else (`metis`, `momus`, `oracle`, `prometheus`, `hephaestus`, `sisyphus`) is on `opus` — reach for those when the task actually warrants deep reasoning, not for routine work `sisyphus-junior` or a portable skill would handle just as well. `start-work` itself has no model tier (it's a skill, not an agent) but fans out across both tiers per item via each plan task's `Agent` field, so its total cost depends on how the plan was authored — a plan leaning on `sisyphus` throughout costs more than one that correctly routes bounded items to `sisyphus-junior`.
