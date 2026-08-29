# Notice

**This software has been modified from its original source.** Everything in `agents/` and most of `skills/` in this plugin originates from [oh-my-openagent](https://github.com/code-yeongyu/oh-my-openagent) (npm: `oh-my-opencode`), copyright YeonGyu-Kim, licensed under the Sustainable Use License v1.0 (full text in `LICENSE.md`, alongside this file).

oh-my-openagent is a multi-agent framework built on top of OpenCode, with its own delegation system (`task()`/categories), state directories (`.omo/`), and tool surface (`lsp_*`, `team_*`, etc.) that don't exist in Claude Code. Every file in this repository was rewritten, not copied verbatim, to strip that framework-specific machinery and adapt the surviving content — prompts, methodology, category tables, decision frameworks — into standalone Claude Code subagents (`.md` files with tool/model frontmatter) and skills (`SKILL.md`). Some files (e.g. `sisyphus.md`, `sisyphus-junior.md`, `atlas.md`, `hephaestus.md`) are substantial rewrites; others (e.g. `metis.md`, `momus.md`) are close ports since the source was already adapted for standalone, non-delegating use.

## Agents (`agents/`)

All 10 of the current agents are adapted from oh-my-openagent agent personas of the same name (`explore`, `librarian`, `metis`, `momus`, `oracle`, `sisyphus`, `sisyphus-junior`, `atlas`, `hephaestus`, `prometheus`). Source: `packages/senpi-task/src/agents/builtin/` and `packages/omo-opencode/src/agents/` in the oh-my-openagent repository. `explore` is registered here as `Explore` (capital E) deliberately, to match and override Claude Code's built-in agent of the same name — see `agents/explore.md`'s `name:` field and the `README.md` note on it.

`atlas` and `prometheus` each also exist as a skill — `start-work` and `ulw-plan` — that runs the same workflow inline in the current conversation instead of sealed off in a subagent context. Both the agents and the skills carry the `Agent` tool and delegate (`atlas`/`start-work` fan implementation out to `sisyphus`/`sisyphus-junior`; `prometheus`/`ulw-plan` fan research out to `Explore`/`librarian`/`metis`); the agent form just returns a summary rather than leaving its work in your conversation. `sisyphus-junior`'s prompt was substantially expanded to mirror `sisyphus`'s discipline (same section structure, scaled to one bounded, pre-scoped task).

## Skills (`skills/`)

Source: `packages/shared-skills/skills/` in the oh-my-openagent repository (its general-purpose skill library, distinct from the skills it uses to maintain its own repo).

Three skills are copied close to verbatim and carry their own upstream attribution/license files, preserved as-is:

- **`ast-grep/`** — ships its own `LICENSE` and `SOURCE` file.
- **`frontend/`** — ships its own `ATTRIBUTION.md` and `LICENSE-Apache-2.0.txt`.
- **`ultimate-browsing/`** — ships its own `ATTRIBUTION.md` (a pinned fork of a third-party project; see that file for details).

The rest (`coding-agent-sessions`, `debugging`, `data-scientist`, `git-master`, `programming`) are copied close to verbatim with no separate license file in the original.

Four skills (`init-deep`, `ulw-plan`, `refactor`, `remove-ai-slops`, `ulw-research`) were substantially rewritten: framework-specific state (`.omo/` directories, a `scaffold-plan.mjs` script dependency, a bespoke cryptographic review-round state machine, a 5-file "epistemic instrumentation" ledger system, team-mode coordination) was removed and replaced with plain Claude Code mechanics (the `Agent` tool for delegation, `TodoWrite`, `AGENTS.md`/plain markdown files instead of `.omo/`).

`start-work` has different provenance from those four: it isn't rewritten from an oh-my-openagent *skill* file at all — it's the `atlas` *agent* persona packaged as a skill so the workflow can run inline in a conversation, with the `atlas` agent kept as the isolated-context form of the same workflow (see Agents section above).

## What this plugin adds

The plugin packaging (`.claude-plugin/plugin.json`), this file, and `LICENSE.md` are original to this plugin. The marketplace packaging one level up (`.claude-plugin/marketplace.json`) is original to the `agent-plugins` repository.

## Full upstream license

See `LICENSE.md` for the complete Sustainable Use License v1.0 text that governs this plugin, matching the license oh-my-openagent uses for this content.
