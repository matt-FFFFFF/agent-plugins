# PROJECT KNOWLEDGE BASE

## OVERVIEW
A Claude Code **plugin marketplace** repo — thin packaging, not application code. One plugin so far (`omo`, adapted from [oh-my-openagent](https://github.com/code-yeongyu/oh-my-openagent)). Young repo: 6 commits, single contributor, no CI, no build system. There is no meaningful code-symbol call graph here — content is agent/skill prompt files (Markdown) plus per-skill helper scripts; see `plugins/omo/AGENTS.md` and the per-skill `AGENTS.md` files for those.

## STRUCTURE
```
.
├── .claude-plugin/
│   └── marketplace.json   # the marketplace manifest — lists every plugin
├── README.md              # human-facing: install instructions, how to add a plugin
└── plugins/
    └── omo/                # the only plugin; see plugins/omo/AGENTS.md
```

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| Add a new plugin to this marketplace | `.claude-plugin/marketplace.json` + new `plugins/<name>/` | See CONVENTIONS below — 4 concrete steps |
| Edit/extend the `omo` plugin (agents, hooks, skills) | `plugins/omo/AGENTS.md` | Real content and conventions live there |
| Understand licensing/attribution before touching vendored content | `plugins/omo/LICENSE.md`, `plugins/omo/NOTICE.md` | See ANTI-PATTERNS |

## CONVENTIONS

**Adding a plugin** (from root `README.md`, verbatim procedure — follow exactly, don't improvise a different structure):
1. Create `plugins/<name>/`.
2. Append `{name, description, version, source, category}` to the `plugins` array in `.claude-plugin/marketplace.json` (`source` is the relative path, e.g. `"./plugins/omo"`).
3. Give it its own `README.md`.
4. If the content is derived/adapted from an upstream project, also add `LICENSE.md` + `NOTICE.md` (the way `omo` does).

**`marketplace.json` schema** — top-level: `$schema`, `name` (currently `matt-FFFFFF`), `description`, `owner.name`. Per-plugin entry: `name`, `description`, `version`, `source`, `category`.

**Version sync**: a plugin's `version` is duplicated in two places — `plugins/<name>/.claude-plugin/plugin.json` and the mirrored entry in root `marketplace.json`. Nothing automates this; bump both by hand or they drift.

**No CHANGELOG, no CONTRIBUTING, no VERSION file** anywhere in the repo — don't invent one unless asked.

**Commit style**: short imperative-mood single-line subjects, no body, no conventional-commits scope prefixes (see `git log --oneline`).

## ANTI-PATTERNS (THIS PROJECT)
- **Don't add root-level CI, a Makefile, or a test runner.** There is none by design — testing is deliberately scoped per-skill inside `plugins/omo/skills/*/`. Don't centralize it.
- **Don't remove or obscure copyright/license notices** in any plugin's `LICENSE.md`/`NOTICE.md`, or in nested upstream license/attribution files a skill carries (e.g. `ast-grep/LICENSE`, `ultimate-browsing/ATTRIBUTION.md`) — see `plugins/omo/AGENTS.md` for the full list and why.
- **Don't assume commercial redistribution is fine.** `omo`'s Sustainable Use License forbids paid/commercial redistribution; check a plugin's own `LICENSE.md` before assuming otherwise for a new one.

## NOTES
- This repo is small enough that a single root `AGENTS.md` plus `plugins/omo/AGENTS.md` covers the marketplace/plugin split; per-skill detail lives even deeper, in each complex skill's own `AGENTS.md` (see `plugins/omo/AGENTS.md`'s WHERE TO LOOK table).
- `.gitignore` is 5 lines: `node_modules/`, `__pycache__/`, `*.pyc`, `.venv/`, `.DS_Store` — this repo mixes Python and Node/Bun tooling across skills; don't assume one runtime.
