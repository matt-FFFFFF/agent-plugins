#!/usr/bin/env bash
# PostToolUse guard: blocks AI-slop comments (restated logic, filler phrases,
# dead TODOs, commented-out code) in Write/Edit/MultiEdit before they land.
# Backed by the comment-checker binary (tree-sitter based) -- no-ops if it
# isn't installed, since it's an optional companion tool like codegraph/caveman.
# Install: npm install -g @code-yeongyu/comment-checker
# https://github.com/code-yeongyu/go-claude-code-comment-checker

set -euo pipefail

command -v comment-checker >/dev/null 2>&1 || exit 0

exec comment-checker
