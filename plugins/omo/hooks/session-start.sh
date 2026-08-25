#!/usr/bin/env bash
# One-time nudge: recommend CodeGraph + caveman + comment-checker if missing.
# None are required -- every omo skill/agent/hook degrades gracefully without
# them -- but all three meaningfully improve what this plugin can do. Fires at
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
command -v comment-checker >/dev/null 2>&1 || missing+=("comment-checker")

[[ ${#missing[@]} -eq 0 ]] && exit 0

if [[ " ${missing[*]} " == *" codegraph "* ]]; then
  cat <<'EOF'
omo tip: CodeGraph isn't installed. The Explore agent and the init-deep/ulw-plan/refactor
skills all use the codegraph_explore MCP tool for faster, more accurate code navigation
when it's present, and fall back to plain grep/glob without it.
  -> curl -fsSL https://raw.githubusercontent.com/colbymchenry/codegraph/main/install.sh | sh
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

if [[ " ${missing[*]} " == *" comment-checker "* ]]; then
  cat <<'EOF'
omo tip: comment-checker isn't installed. A PostToolUse hook in this plugin uses it to
block AI-slop comments (restated logic, filler phrases, dead TODOs, commented-out code)
in Write/Edit/MultiEdit before they land, and no-ops silently without it.
  -> npm install -g @code-yeongyu/comment-checker
EOF
fi

echo "(one-time notice from the omo plugin -- it works fine without any of them; this won't show again)"
exit 0
