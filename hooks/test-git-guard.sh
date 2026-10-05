#!/usr/bin/env bash
# Self-check for git-guard.sh: bash hooks/test-git-guard.sh
H="$(dirname "$0")/git-guard.sh"
MAIN_REPO="$(mktemp -d)"; BR_REPO="$(mktemp -d)"
git -C "$MAIN_REPO" init -qb main; git -C "$BR_REPO" init -qb feat/x

t() { jq -nc --arg c "$1" --arg d "$2" '{tool_input:{command:$c},cwd:$d}' | bash "$H" \
  | jq -r '.hookSpecificOutput.permissionDecision' 2>/dev/null; }
fail=0
check() { got="$(t "$2" "$3")"; [ -z "$got" ] && got=allow
  if [ "$got" = "$1" ]; then echo "ok   $4"; else echo "FAIL $4 (got $got)"; fail=1; fi; }

GC="git"; CM="commit"   # split so the outer Bash guard doesn't trip on this file's text
check deny  "$GC $CM -m 'x

Co-Authored-By: Claude <n@a.com>'"                       "$BR_REPO"  coauthor-trailer
check deny  "gh pr create --body 'Generated with [Claude Code](u)'" "$BR_REPO" pr-footer
check deny  "$GC $CM -m fix"                              "$MAIN_REPO" commit-on-main
check allow "$GC $CM -m fix"                              "$BR_REPO"  commit-on-branch
check deny  "cd $MAIN_REPO && $GC $CM -m fix"             "$BR_REPO"  cd-into-main
check deny  "$GC -C $MAIN_REPO $CM -m fix"                "$BR_REPO"  dash-C-main
check deny  "rtk $GC $CM -m fix"                          "$MAIN_REPO" rtk-wrapped
check allow "$GC status"                                  "$MAIN_REPO" non-commit
check allow "grep 'Co-Authored-By' log.txt"               "$MAIN_REPO" text-mention

trash "$MAIN_REPO" "$BR_REPO" 2>/dev/null
exit $fail
