#!/usr/bin/env bash
# PreCompact hook: inject CLAUDE.md + memory index into compaction context
input=$(cat)
cwd=$(echo "$input" | jq -r '.workspace.current_dir // .cwd // ""' 2>/dev/null)
[ -z "$cwd" ] && cwd="$PWD"

git -C "$cwd" rev-parse --git-dir > /dev/null 2>&1 || exit 0

context=""
sanitized=$(echo "$cwd" | sed 's|/|-|g')
memory_index="$HOME/.claude/projects/${sanitized}/memory/MEMORY.md"
[ -f "$memory_index" ] && context+=$'=== MEMORY INDEX ===\n'"$(cat "$memory_index")"$'\n\n'

claude_md="$cwd/CLAUDE.md"
[ -f "$claude_md" ] && context+=$'=== CLAUDE.md ===\n'"$(cat "$claude_md")"$'\n'

[ -z "$context" ] && exit 0

# PreCompact additionalContext capped at 10000 chars
if [ "${#context}" -gt 9950 ]; then
  context="${context:0:9900}"$'\n…[truncated]'
fi

jq -n --arg ctx "$context" \
  '{hookSpecificOutput:{hookEventName:"PreCompact",additionalContext:$ctx}}'
