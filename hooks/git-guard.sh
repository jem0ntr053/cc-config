#!/usr/bin/env bash
# PreToolUse(Bash) guard for git/gh — enforces two standing rules:
#   1. No Co-Authored-By trailer / "Generated with Claude Code" line in commits or PRs.
#   2. Never `git commit` on main/master — branch first.
# ponytail: inspects only the command text; a message passed via `-F file` / `--body-file`
# isn't read. Add file inspection if that path ever slips through.

input="$(cat)"
cmd="$(printf '%s' "$input" | jq -r '.tool_input.command // empty' 2>/dev/null)"
[ -z "$cmd" ] && exit 0

deny() {
  jq -nc --arg r "$1" \
    '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"deny",permissionDecisionReason:$r}}'
  exit 0
}

is_commit=0; is_pr=0
printf '%s' "$cmd" | grep -Eq '(^|[^[:alnum:]_-])git([[:space:]]+-C[[:space:]]+[^[:space:]]+)?[[:space:]]+commit([[:space:]]|$)' && is_commit=1
printf '%s' "$cmd" | grep -Eq '(^|[^[:alnum:]_-])gh[[:space:]]+pr[[:space:]]+(create|edit)([[:space:]]|$)' && is_pr=1
[ "$is_commit" = 0 ] && [ "$is_pr" = 0 ] && exit 0

# --- Rule 1: attribution lines ---
if printf '%s' "$cmd" | grep -Eiq 'co-authored-by|generated with \[?claude code'; then
  deny "Attribution blocked: remove the Co-Authored-By trailer / 'Generated with Claude Code' line (standing user rule) and retry."
fi

# --- Rule 2: no commits on main/master ---
if [ "$is_commit" = 1 ]; then
  dir="$(printf '%s' "$input" | jq -r '.cwd // empty')"
  # Honor `git -C <path>` or a leading `cd <path> &&`.
  c_path="$(printf '%s' "$cmd" | sed -nE 's/.*git[[:space:]]+-C[[:space:]]+([^[:space:]]+)[[:space:]]+commit.*/\1/p')"
  cd_path="$(printf '%s' "$cmd" | sed -nE 's/^[[:space:]]*cd[[:space:]]+([^[:space:];&]+)[[:space:]]*&&.*/\1/p')"
  [ -n "$cd_path" ] && dir="${cd_path/#\~/$HOME}"
  [ -n "$c_path" ] && dir="${c_path/#\~/$HOME}"
  branch="$(git -C "${dir:-.}" symbolic-ref --short HEAD 2>/dev/null)"
  case "$branch" in
    main|master) deny "Commit on '$branch' blocked: create a branch first (git switch -c <type>/<slug>), then commit." ;;
  esac
fi

exit 0
