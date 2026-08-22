# agent-plugins

A Claude Code plugin bundling a roster of subagents and skills adapted from [oh-my-openagent](https://github.com/code-yeongyu/oh-my-openagent) — see `NOTICE.md` for what was changed and `LICENSE.md` for the terms this repository is distributed under (free, non-commercial redistribution only, attribution required).

## Install

```
claude plugin marketplace add /path/to/agent-plugins
claude plugin install omo@agent-plugins
```

(Once pushed to a git host, replace the local path with the repo URL.)

## What's in it

### Agents (`plugins/omo/agents/`)

| Agent | Model | Role |
|---|---|---|
| `explore` | haiku | Fast contextual grep for codebases |
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

### Skills (`plugins/omo/skills/`)

- **Portable, close to verbatim**: `ast-grep`, `frontend`, `coding-agent-sessions`, `debugging`, `ultimate-browsing`, `data-scientist`, `git-master`, `programming`.
- **Adapted with real delegation**: `init-deep` (hierarchical `AGENTS.md` generation via parallel `explore` agents + CodeGraph), `ulw-plan` (Prometheus-style planning that delegates to `explore`/`librarian`/`metis`/`momus`/`oracle`), `refactor` (codemap-driven refactor via `explore` + the `Plan` agent), `remove-ai-slops` (10-category AI-slop cleanup via `sisyphus-junior`), `ulw-research` (maximum-saturation research swarm with an EXPAND lead-chasing loop and verify-by-running-code).

## Why these exist

oh-my-openagent is its own multi-agent coding framework (built on OpenCode) with a delegation system, state directories, and tool surface that don't exist in Claude Code. Nothing here is a straight copy — every file was rewritten to drop that framework-specific machinery while keeping the underlying prompts, discipline, and methodology. Full provenance is in `NOTICE.md`.
