#!/usr/bin/env bash
# Nightly inspect-only swarm: /swarm --audit then --dry-run per opted-in repo, one ntfy digest.
# Never runs an implement pass. Usage: SWARM_NTFY_TOPIC=<url> swarm_nightly.sh
set -euo pipefail
# launchd's PATH has no claude/gh/jq; an interactive or test PATH already does
command -v claude >/dev/null || export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
read -ra REPOS <<< "${SWARM_REPOS:-/Users/montrose/Developer/GitRepositories/daily-operating-system /Users/montrose/Developer/GitRepositories/AutoCrate}"
TOPIC="${SWARM_NTFY_TOPIC:?set SWARM_NTFY_TOPIC}"
LOG="${SWARM_NIGHTLY_LOG:-/tmp/swarm-nightly.log}"
# headless -p kills a background Workflow after 600 s by default; audits run longer.
# 2 h, not 0 (forever): a hung run must still end so the digest posts.
export CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=7200000
# headless sessions refuse every tool without a permission mode; these writes are never needed at night.
# ponytail: a denylist, so a Bash write not named here is auto-approved; switch to --allowedTools if a run ever writes code.
NO_CODE=(Edit Write NotebookEdit "Bash(gh pr:*)" "Bash(git push:*)" "Bash(/usr/bin/git push:*)"
         "Bash(git commit:*)" "Bash(/usr/bin/git commit:*)" "Bash(git checkout:*)")
NO_GH=("Bash(gh issue edit:*)" "Bash(gh issue comment:*)" "Bash(gh issue create:*)" "Bash(gh issue close:*)" "Bash(gh label:*)")
: > "$LOG"
summary=""
tracked() { git -C "$1" status --porcelain | grep -v '^??' || true; }
for r in "${REPOS[@]}"; do
  name=$(basename "$r")
  [ -f "$r/.swarm.json" ] || { echo "skip (no .swarm.json): $r" >>"$LOG"; summary+="${name}: skipped (not opted in)"$'\n'; continue; }
  before=$(tracked "$r"); failed=""
  # audit files findings as swarm-found issues, so it keeps gh issue create; dry-run writes nothing
  ( cd "$r" && claude -p "/swarm --audit" --permission-mode auto --disallowedTools "${NO_CODE[@]}" >>"$LOG" 2>&1 ) \
    || { echo "audit failed: $name" >>"$LOG"; failed+=", audit FAILED"; }
  ( cd "$r" && claude -p "/swarm --dry-run" --permission-mode auto --disallowedTools "${NO_CODE[@]}" "${NO_GH[@]}" >>"$LOG" 2>&1 ) \
    || { echo "triage failed: $name" >>"$LOG"; failed+=", triage FAILED"; }
  [ "$(tracked "$r")" = "$before" ] && tree=unchanged || tree=CHANGED
  summary+="${name}: tree ${tree}${failed}"$'\n'
done
# ponytail: findings-count parsing is left to the digest reader; scrape counts from $LOG later if the tree line proves too coarse.
curl -s -H "Title: swarm nightly" -d "$summary" "$TOPIC" >/dev/null || true
echo "$summary" >>"$LOG"
