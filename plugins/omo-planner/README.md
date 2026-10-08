# omo-planner

A planning-only port of [oh-my-openagent](https://github.com/code-yeongyu/oh-my-openagent)'s OpenCode planning path (the Prometheus agent and the `ulw-plan` skill) for Claude Code. It explores your repo first, asks only the questions it has to, waits for your explicit okay, and then writes one decision-complete work plan in the exact format oh-my-openagent (OMO) expects. It never executes anything. You run the finished plan later in OpenCode with `/ulw-execute`. The content is derived from oh-my-openagent under the Sustainable Use License v1.0: you may redistribute it free of charge for non-commercial purposes only. See [NOTICE.md](NOTICE.md) and [LICENSE.md](LICENSE.md).

## Install

```
claude plugin marketplace add matt-FFFFFF/agent-plugins
claude plugin install omo-planner@matt-FFFFFF
```

## Use

There are two entry points. Both run the same workflow, the `omo-planner:plan` skill.

- **Inline:** type `/omo-planner:plan <request>` in any Claude Code session. The skill also activates when you explicitly ask for an OMO plan ("omo plan", "ulw-plan", "write an OMO plan").
- **Dedicated planner session:** start Claude Code with `claude --agent omo-planner:planner`. The planner agent becomes the main thread, loads the skill as its first action, and runs with the write guard on.

Never run the planner as a subagent. It interviews you with `AskUserQuestion` and holds an approval gate, and subagents can do neither. The write guard denies any attempt to spawn `omo-planner:planner` through the `Agent` tool.

A session opens with `ULW-PLAN MODE ENABLED!`, then parallel read-only research, an announced intent verdict (CLEAR or UNCLEAR, plus whether high-accuracy review is required), questions only for genuine owner decisions, an approval brief, and the plan once you approve. Say "high accuracy" at any point to require the dual review (`omo-planner:plan-critic` plus `omo-planner:plan-auditor`, capped at 5 rounds unless you ask for more).

## What it writes

Only two files per plan, both in the target repo:

- `.omo/drafts/<slug>.md`, the durable draft and resume point (intent, review flag, decisions, approval gate, ledgers). It's created before approval with `scaffold-plan.mjs --draft-only`.
- `.omo/plans/<slug>.md`, the plan itself, created only after you approve.

Plans keep the upstream section headers, in this order:

1. `## TL;DR (For humans)`
2. `## Scope`
3. `## Verification strategy`
4. `## Execution strategy` (with `### Parallel execution waves` and `### Dependency matrix`)
5. `## Todos`
6. `## Final verification wave`
7. `## Commit strategy`
8. `## Success criteria`

Each implementation todo is a `- [ ] N. <title>` row carrying these nested fields:

```text
  Recommended task executor category: <category> - <reason>
  Parallelization: Wave <N> | Blocked by: <ids|none> | Blocks: <ids|none>
  References: <exhaustive paths:lines>
  Acceptance criteria: <agent-executable commands/assertions>
  QA scenarios: <happy + failure, exact tool + invocation, evidence path>
  Commit: <Y|N> | <message>
```

The category must be one of OpenCode's 9 built-ins: `quick`, `unspecified-low`, `unspecified-high`, `visual-engineering`, `artistry`, `writing`, `deep-low`, `deep-high`, `ultrabrain`. Git work goes to `quick`. There's no per-todo skills field. The final verification wave is always F1 Plan compliance audit, F2 Code quality review, F3 Real manual QA and F4 Ideal-state fidelity.

## Agents

| Identifier | Upstream persona | Model | Role |
| --- | --- | --- | --- |
| skill `plan` -> `/omo-planner:plan` | `ulw-plan` skill | - | Planning workflow (canonical) |
| `omo-planner:planner` | Prometheus - Plan Builder | opus | Main-thread planner via `claude --agent` |
| `omo-planner:codebase-explorer` | explore | haiku | Internal codebase search |
| `omo-planner:docs-researcher` | librarian | haiku | External docs/OSS research |
| `omo-planner:gap-analyst` | Metis - Plan Consultant | opus | Gap analysis + contrarian self-grill |
| `omo-planner:plan-critic` | Momus - Plan Critic | opus, effort high | High-accuracy review lane 1 |
| `omo-planner:plan-auditor` | oracle | opus, effort high | Independent review lane 2 + hard architecture forks |

The five research and review agents are read-only. They can't use Write, Edit, MultiEdit, NotebookEdit or Agent, but keep every other tool, including MCP read tools. The planner can spawn only those five.

## Checking a plan

```
node <plugin-root>/skills/plan/scripts/check-plan.mjs .omo/plans/<slug>.md [--digest] [--json]
```

Run it from the target repo root (`bun` works too). Flags can go in any position. `--digest` prints the sha256 of the bytes it checked (only when the plan passes), which the review lanes bind to. `--json` prints `{ok, errors, todos, sha256}`.

| Exit | Meaning |
| --- | --- |
| 0 | Plan passes |
| 1 | Structural errors, one `ERROR <rule> line <n>: <message>` line each (stops after 200) |
| 2 | `INCONCLUSIVE`: path isn't `.omo/plans/<slug>.md`, a symlink in the path, file changed during read, or plan over 1 MiB |
| 64 | Usage error |

The checker uses the same todo and final-wave parsing regexes as OMO's boulder parser, so a plan that passes is countable by OMO's executor. On top of that it enforces the fields above, the 9 categories, a dependency matrix that matches every `Parallelization:` line, Blocks/Blocked-by reciprocity in both directions, an acyclic graph, waves that follow their dependencies, a non-empty commit strategy, an Effort band and no unfilled placeholders.

## Write guard

`hooks/planner-guard.mjs` is a `PreToolUse` hook on `Write|Edit|MultiEdit|NotebookEdit` and `Agent|Task`. It does two things:

- While the planner agent (`omo-planner:planner`) is active, it denies any write that isn't a `.md` file under a `.omo/` directory inside the project, and any write with a missing or non-string path.
- In any session, it denies spawning `omo-planner:planner` as a subagent.

It doesn't touch ordinary sessions otherwise. The hook needs `node` on PATH. Without node the hook doesn't run and the guard is off. Inline `/omo-planner:plan` isn't guarded either: it relies on the skill's own discipline plus `scaffold-plan.mjs`, which refuses to write outside `.omo/`. Bash isn't gated, same as upstream.

## Executing the plan

This plugin never executes plans. Open the repo in OpenCode with oh-my-openagent installed and run:

```
/ulw-execute <slug>
```

OMO's options include `--worktree <abs-path>`, `--make-pr` and `--ship`.

## Requirements

- Claude Code with plugin support.
- Node >= 18 on PATH for the scaffold and checker scripts (Bun also works for these) and for the write guard hook (node only).
