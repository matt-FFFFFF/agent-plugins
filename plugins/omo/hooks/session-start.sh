#!/usr/bin/env bash
# One-time nudge: recommend CodeGraph + caveman if either is missing.
# Neither is required -- every omo skill/agent degrades gracefully without
# them -- but both meaningfully improve what this plugin can do. Fires at
# most once ever per install (marker lives in CLAUDE_PLUGIN_DATA, which
# survives plugin updates).

set -euo pipefail

MARKER="${CLAUDE_PLUGIN_DATA:-/tmp}/.omo-tools-nudge-shown"
[[ -f "$MARKER" ]] && exit 0
mkdir -p "$(dirname "$MARKER")"
touch "$MARKER"

missing=()
command -v codegraph >/dev/null 2>&1 || missing+=("codegraph")
command -v caveman >/dev/null 2>&1 || missing+=("caveman")

[[ ${#missing[@]} -eq 0 ]] && exit 0

if [[ " ${missing[*]} " == *" codegraph "* ]]; then
  cat <<'EOF'
omo tip: CodeGraph isn't installed. The Explore agent and the init-deep/ulw-plan/refactor
skills all use the codegraph_explore MCP tool for faster, more accurate code navigation
when it's present, and fall back to plain grep/glob without it.
  -> https://github.com/colbymchenry/codegraph
EOF
fi

if [[ " ${missing[*]} " == *" caveman "* ]]; then
  cat <<'EOF'
omo tip: caveman isn't installed. ulw-research, ulw-plan, and init-deep all fan work
out to several subagents at once -- caveman compresses that traffic before it lands
back in your main context, which can cut token usage meaningfully on those workflows.
  -> npm install -g @caveman-ai/cli && caveman setup --install
  -> npx skills add JuliusBrussee/caveman
EOF
fi

echo "(one-time notice from the omo plugin -- it works fine without either; this won't show again)"
exit 0
