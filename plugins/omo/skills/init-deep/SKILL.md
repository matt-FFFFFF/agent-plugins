---
name: init-deep
description: "Generate a hierarchical AGENTS.md knowledge base — a root file plus complexity-scored subdirectory files, built from parallel Explore-agent research and CodeGraph when available. More thorough than a single root AGENTS.md: each subdirectory earns its own file only if it scores as complex/distinct enough, and children never repeat what the parent already says. Triggers: init-deep, deep init, hierarchical AGENTS.md, per-directory knowledge base, generate AGENTS.md for every module."
---

# init-deep

Generate hierarchical `AGENTS.md` files: root + complexity-scored subdirectories. `AGENTS.md` is the cross-tool convention (Claude Code, Codex, and other coding agents all read it), so a good subdirectory file saves re-discovering the same conventions every time work touches that area — regardless of which agent is doing the work.

## Usage

- Default (update mode): modify existing files, create new ones where warranted.
- `--create-new`: read existing files first (preserve their insight), then regenerate everything from scratch.
- `--max-depth=N`: limit directory depth considered (default 3).

## Workflow (high level)

1. **Discovery + Analysis** (concurrent) — fire parallel `Explore` agents immediately; meanwhile do bash structural analysis + CodeGraph/grep code mapping + read existing `AGENTS.md` files yourself.
2. **Score & Decide** — determine which directories earn their own `AGENTS.md` from the merged findings.
3. **Generate** — root first (full treatment), then subdirectories.
4. **Review** — deduplicate against parents, trim to size limits, verify telegraphic style.

Track all four phases with `TodoWrite`, marking each `in_progress` → `completed` as you go.

---

## Phase 1: Discovery + Analysis (concurrent)

### Fire Explore agents immediately

Don't wait for them — they run while you do the rest of this phase yourself. Fire these via the `Agent` tool (`subagent_type: "Explore"`), all in one message so they run in parallel:

- **Structure**: map the real layout, report deviations from standard patterns for this stack.
- **Entry points**: find main files, trace what they reach, report non-standard organization.
- **Conventions**: find config files (`.eslintrc`, `pyproject.toml`, `.editorconfig`, etc.), report project-specific rules.
- **Anti-patterns**: find `DO NOT` / `NEVER` / `ALWAYS` / `DEPRECATED` comments, list forbidden patterns.
- **Build/CI**: find `.github/workflows`, `Makefile`, etc., report non-standard patterns.
- **Test patterns**: find test configs/structure, report unique conventions.

**Scale up for large projects** — after the bash structural pass below, fire additional `Explore` agents based on project size:

| Factor | Threshold | Additional agents |
|---|---|---|
| Total files | >100 | +1 per 100 files |
| Total lines | >10k | +1 per 10k lines |
| Directory depth | ≥4 | +2 for deep exploration |
| Large files (>500 lines) | >10 files | +1 for complexity hotspots |
| Monorepo detected | — | +1 per package/workspace |
| Multiple languages | >1 | +1 per language |

### Meanwhile, do this yourself

**Bash structural analysis:**
```bash
# Directory depth + file counts
find . -type d -not -path '*/.*' -not -path '*/node_modules/*' -not -path '*/venv/*' -not -path '*/dist/*' -not -path '*/build/*' | awk -F/ '{print NF-1}' | sort -n | uniq -c

# Files per directory (top 30)
find . -type f -not -path '*/.*' -not -path '*/node_modules/*' | sed 's|/[^/]*$||' | sort | uniq -c | sort -rn | head -30

# Code concentration by extension
find . -type f \( -name "*.py" -o -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.go" -o -name "*.rs" \) -not -path '*/node_modules/*' | sed 's|/[^/]*$||' | sort | uniq -c | sort -rn | head -20

# Existing knowledge-base files
find . -type f \( -name "AGENTS.md" -o -name "CLAUDE.md" \) -not -path '*/node_modules/*' 2>/dev/null
```

**Read existing `AGENTS.md` files found** (and any legacy `CLAUDE.md` — fold its content in, since `AGENTS.md` is now the target) — extract key insights, conventions, anti-patterns into a running map. If `--create-new`: read all existing first (preserve the context), then remove them, then regenerate.

**Code map — CodeGraph first when present:** if the repo has a `.codegraph/` directory, use `codegraph_explore` (and `codegraph_search`/`codegraph_callers`/`codegraph_callees`/`codegraph_impact`/`codegraph_files` for targeted queries) for an overview, symbol inventory, and reference centrality — this feeds the scoring matrix below. If CodeGraph isn't available, fall back to the `Explore` agents' findings plus `Grep`/`Glob` and the `ast-grep` skill (if installed), and mark centrality as unmeasured.

**Collect the Explore agents' results** as their notifications arrive, then merge: bash findings + code map + existing files + Explore findings. Mark discovery `completed`.

---

## Phase 2: Scoring & Location Decision

| Factor | Weight | High threshold | Source |
|---|---|---|---|
| File count | 3x | >20 | bash |
| Subdir count | 2x | >5 | bash |
| Code ratio | 2x | >70% | bash |
| Unique patterns | 1x | has own config | Explore |
| Module boundary | 2x | has `index.ts`/`__init__.py` | bash |
| Symbol density | 2x | >30 symbols | CodeGraph |
| Export count | 2x | >10 exports | CodeGraph |
| Reference centrality | 3x | >20 refs | CodeGraph |

**Decision rules:**

| Score | Action |
|---|---|
| Root (`.`) | ALWAYS create |
| >15 | Create `AGENTS.md` |
| 8-15 | Create if it's a distinct domain |
| <8 | Skip — the parent covers it |

Produce a location list, e.g.: `[{path: ".", type: "root"}, {path: "src/hooks", score: 18, reason: "high complexity"}, {path: "src/api", score: 12, reason: "distinct domain"}]`.

---

## Phase 3: Generate

**File writing rule**: if `AGENTS.md` already exists at the target path, use `Edit`. If it doesn't exist, use `Write`. Never blindly `Write` over an existing file — check first.

### Root `AGENTS.md` (full treatment)

```markdown
# PROJECT KNOWLEDGE BASE

## OVERVIEW
{1-2 sentences: what + core stack}

## STRUCTURE
```
{root}/
├── {dir}/    # {non-obvious purpose only}
└── {entry}
```

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|

## CODE MAP
{from CodeGraph/Explore findings — skip only if neither exists or the project is <10 files}

| Symbol | Type | Location | Refs | Role |
|--------|------|----------|------|------|

## CONVENTIONS
{ONLY deviations from standard}

## ANTI-PATTERNS (THIS PROJECT)
{explicitly forbidden here}

## UNIQUE STYLES
{project-specific}

## COMMANDS
```bash
{dev/test/build}
```

## NOTES
{gotchas}
```

**Quality gate**: 50-150 lines, no generic advice, no obvious info.

### Subdirectory `AGENTS.md`

For each location from Phase 2 (except root), write it yourself from the merged findings — 30-80 lines max, NEVER repeat parent content. Sections: OVERVIEW (1 line), STRUCTURE (only if >5 subdirs), WHERE TO LOOK, CONVENTIONS (only if different from parent), ANTI-PATTERNS. Independent files can be written in parallel (multiple `Write`/`Edit` calls in one turn).

Mark generate `completed`.

---

## Phase 4: Review & Deduplicate

For each generated file: remove generic advice, remove anything the parent already covers, trim to the size limits above, verify the style is telegraphic (dense fact fragments, not prose paragraphs).

---

## Final Report

```
=== init-deep Complete ===

Mode: {update | create-new}

Files:
  [OK] ./AGENTS.md (root, {N} lines)
  [OK] ./src/hooks/AGENTS.md ({N} lines)

Dirs Analyzed: {N}
AGENTS.md Created: {N}
AGENTS.md Updated: {N}

Hierarchy:
  ./AGENTS.md
  └── src/hooks/AGENTS.md
```

---

## Anti-Patterns

- **Static agent count**: vary the number of `Explore` agents fired with project size/depth.
- **Sequential execution**: run Explore agents + CodeGraph + bash analysis concurrently, not one after another.
- **Ignoring existing files**: always read existing `AGENTS.md` first, even with `--create-new`.
- **Over-documenting**: not every directory needs its own `AGENTS.md` — that's what the scoring matrix is for.
- **Redundancy**: a child file never repeats what its parent already says.
- **Generic content**: cut anything that would apply to any project, not just this one.
- **Verbose style**: telegraphic or don't write it.
