# omo

A roster of 10 Claude Code subagents and 13 skills adapted from [oh-my-openagent](https://github.com/code-yeongyu/oh-my-openagent) — see `NOTICE.md` for exactly what was changed, and `LICENSE.md` for the terms this plugin is distributed under (free, non-commercial redistribution only, attribution required).

## Recommended companion tools (optional)

Nothing here requires either — every agent and skill degrades gracefully without them. But two tools meaningfully improve what this plugin can do, and a one-time `SessionStart` hook (`hooks/session-start.sh`) will mention whichever one is missing the first time you use this plugin, then stay silent:

- **[CodeGraph](https://github.com/colbymchenry/codegraph)** — the `Explore` agent and the `init-deep`/`ulw-plan`/`refactor` skills all reach for the `codegraph_explore` MCP tool first when it's present, for faster and more accurate code navigation than grep/glob alone.
- **[caveman](https://github.com/JuliusBrussee/caveman)** — `ulw-research`, `ulw-plan`, and `init-deep` all fan work out to several subagents at once; caveman compresses that traffic before it lands back in your main context, which can cut token usage meaningfully on those workflows.
  ```
  npm install -g @caveman-ai/cli && caveman setup --install
  npx skills add JuliusBrussee/caveman
  ```

## Agents (`agents/`)

| Agent | Model | Role |
|---|---|---|
| `Explore` | haiku | Fast contextual grep for codebases (overrides Claude Code's built-in `Explore`) |
| `librarian` | haiku | External docs / OSS research, GitHub-permalink evidence |
| `metis` | opus | Pre-planning consultant — surfaces hidden intent, ambiguity, AI-slop risk |
| `momus` | opus | Practical plan reviewer — approves by default, blocks only on real gaps |
| `oracle` | opus | Deep-reasoning strategic advisor for hard debugging/architecture calls |
| `sisyphus-junior` | sonnet | Single bounded task, executes, verifies once, stops |
| `prometheus` | opus | Explore-first planner — writes a decision-complete plan, never implements |
| `atlas` | sonnet | Grinds a checklist/plan file to completion, item by item |
| `hephaestus` | opus | Autonomous deep worker for hard, open-ended goals |
| `sisyphus` | opus | General-purpose implementation workhorse |

None of these delegate to each other — each is self-contained, since Claude Code subagents don't recurse. The **skills** below are where real delegation happens (they run in a context with `Agent` tool access and fan work out to the agents above).

## Skills (`skills/`)

- **Portable, close to verbatim**: `ast-grep`, `frontend`, `coding-agent-sessions`, `debugging`, `ultimate-browsing`, `data-scientist`, `git-master`, `programming`.
- **Adapted with real delegation**: `init-deep` (hierarchical `AGENTS.md` generation via parallel `Explore` agents + CodeGraph), `ulw-plan` (Prometheus-style planning that delegates to `Explore`/`librarian`/`metis`/`momus`/`oracle`), `refactor` (codemap-driven refactor via `Explore` + the `Plan` agent), `remove-ai-slops` (10-category AI-slop cleanup via `sisyphus-junior`), `ulw-research` (maximum-saturation research swarm with an EXPAND lead-chasing loop and verify-by-running-code).

## Why these exist

oh-my-openagent is its own multi-agent coding framework (built on OpenCode) with a delegation system, state directories, and tool surface that don't exist in Claude Code. Nothing here is a straight copy — every file was rewritten to drop that framework-specific machinery while keeping the underlying prompts, discipline, and methodology. Full provenance is in `NOTICE.md`.

## How to use

**Skills are the front door.** They activate on their trigger phrases (each `SKILL.md` frontmatter lists them) or you can invoke one by name. Most of the day-to-day value is here, not in manually picking an agent:

- Starting something non-trivial and want a plan first → say **"ulw-plan"** or "plan this". It interviews you only where it has to, then writes a decision-complete plan and delegates review to `metis`/`momus`/`oracle` for you.
- Want a codebase-wide `AGENTS.md` knowledge base → **"init-deep"**.
- Refactoring with real risk of breaking something → **"refactor `<target>`"**.
- Cleaning up AI-generated code smell on a branch → **"remove ai slops"**.
- Need exhaustive, cited research (not a quick question) → **"ulw-research `<topic>`"**.
- Everyday coding conventions (Python/Rust/TypeScript/Go), git hygiene, debugging methodology, data work, frontend/design work, structural code search — the portable skills (`programming`, `git-master`, `debugging`, `data-scientist`, `frontend`, `ast-grep`) mostly trigger themselves from context; you rarely need to name them.

**Reach for an agent directly when you want to delegate a whole unit of work out of your current context**, not just load methodology into it. Rule of thumb, cheapest-fitting first:

1. **Just need to find something** (a file, a symbol, "where is X handled") → `Explore`. It's on haiku — fire several in parallel, they're cheap.
2. **Need external/library research** (docs, GitHub examples, "how does library Y actually behave") → `librarian`.
3. **Have a bounded, well-scoped task** ("fix this one function", "add this one endpoint") → `sisyphus-junior`. It executes, verifies once, and stops — don't reach for something heavier.
4. **Have an existing plan/checklist file to execute start-to-finish** → `atlas`. It won't stop to ask between items.
5. **Have a genuinely hard, open-ended, or ambiguous goal** ("make search faster", "figure out why this leaks memory") → `hephaestus`. Give it the goal, not the steps — it explores exhaustively before acting and won't stop early.
6. **General implementation work that's bigger than sisyphus-junior but doesn't need hephaestus's exhaustive autonomy** → `sisyphus`. This is the reasonable default when in doubt.
7. **Before committing to an approach on something risky** → `metis` (surfaces what you haven't thought about) and/or `oracle` (a second opinion from a strong reasoning model) *before* you implement, not after.
8. **Reviewing a plan someone else (or `prometheus`) wrote** → `momus`. It's biased toward approving — it's a blocker-finder, not a perfectionist, so don't expect nitpicks.

**A typical end-to-end flow**: `ulw-plan` (or the `prometheus` agent directly, if you want it isolated from your main conversation) → `atlas` or `sisyphus` executes the resulting plan → `remove-ai-slops` on the branch before opening a PR. For a single hard problem instead of a multi-step plan, skip straight to `hephaestus`.

**Cost awareness**: `Explore`/`librarian` are on `haiku` — cheap, use them liberally for research. `sisyphus-junior`/`atlas` are on `sonnet`. Everything else (`metis`, `momus`, `oracle`, `prometheus`, `hephaestus`, `sisyphus`) is on `opus` — reach for those when the task actually warrants deep reasoning, not for routine work `sisyphus-junior` or a portable skill would handle just as well.
