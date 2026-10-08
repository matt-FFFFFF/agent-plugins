# PROJECT KNOWLEDGE BASE

## OVERVIEW
A Claude Code **plugin marketplace** repo: thin packaging, not application code. One plugin so far, `omo-planner`, a planning-only port of [oh-my-openagent](https://github.com/code-yeongyu/oh-my-openagent)'s OpenCode `ulw-plan`/Prometheus path. Single contributor, no CI, no build system. Content is agent/skill prompt files (Markdown) plus Node scripts and hooks; see `plugins/omo-planner/AGENTS.md` for those.

## STRUCTURE
```
.
├── .claude-plugin/
│   └── marketplace.json   # the marketplace manifest, lists every plugin
├── README.md              # human-facing: install instructions, migration note, how to add a plugin
└── plugins/
    └── omo-planner/       # the only plugin; see plugins/omo-planner/AGENTS.md
```

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| Add a new plugin to this marketplace | `.claude-plugin/marketplace.json` + new `plugins/<name>/` | See CONVENTIONS below, 4 concrete steps |
| Edit/extend the `omo-planner` plugin (agents, hooks, skills, scripts) | `plugins/omo-planner/AGENTS.md` | Real content and conventions live there |
| Understand licensing/attribution before touching derived content | `plugins/omo-planner/LICENSE.md`, `plugins/omo-planner/NOTICE.md` | See ANTI-PATTERNS |

## CONVENTIONS

**Adding a plugin** (from root `README.md`, verbatim procedure; follow exactly, don't improvise a different structure):
1. Create `plugins/<name>/`.
2. Append `{name, description, version, source, category}` to the `plugins` array in `.claude-plugin/marketplace.json` (`source` is the relative path, e.g. `"./plugins/omo-planner"`).
3. Give it its own `README.md`.
4. If the content is derived/adapted from an upstream project, also add `LICENSE.md` + `NOTICE.md` (the way `omo-planner` does).

**`marketplace.json` schema**: top-level `$schema`, `name` (currently `matt-FFFFFF`), `description`, `owner.name`. Per-plugin entry: `name`, `description`, `version`, `source`, `category`.

**Version sync**: a plugin's `version` is duplicated in two places, `plugins/omo-planner/.claude-plugin/plugin.json` and the mirrored entry in root `marketplace.json`. Nothing automates this; bump both by hand or they drift.

**No CHANGELOG, no CONTRIBUTING, no VERSION file** anywhere in the repo. Don't invent one unless asked.

**Commit style**: short imperative-mood single-line subjects, no body, no conventional-commits scope prefixes (see `git log --oneline`).

## ANTI-PATTERNS (THIS PROJECT)
- **Don't add root-level CI, a Makefile, or a test runner.** There is none by design; testing is scoped inside the plugin. Don't centralize it.
- **Don't remove or obscure copyright/license notices** in `plugins/omo-planner/LICENSE.md` or `plugins/omo-planner/NOTICE.md`.
- **Don't assume commercial redistribution is fine.** `omo-planner`'s Sustainable Use License forbids paid/commercial redistribution; check a plugin's own `LICENSE.md` before assuming otherwise for a new one.

## NOTES
- Testing is `node --test` inside the plugin: `node --test "plugins/omo-planner/skills/plan/scripts/tests/*.test.mjs" "plugins/omo-planner/hooks/tests/*.test.mjs"`.
- Runtime is Node only now. No Python, no Bun.
- `.omo/` at the repo root holds this repo's own planning artifacts (plans, drafts, evidence). It's never committed.
