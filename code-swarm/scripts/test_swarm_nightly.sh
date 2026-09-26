#!/usr/bin/env bash
# Runs swarm_nightly.sh against scratch repos with stub claude/curl; asserts it only audits and dry-runs.
# Usage: bash code-swarm/scripts/test_swarm_nightly.sh
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
mkdir -p "$T/bin"
cat > "$T/bin/claude" <<'EOF'
#!/usr/bin/env bash
printf '%s|%s|wait=%s\n' "$PWD" "$*" "${CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS:-unset}" >> "$STUB_CALLS"
[ -n "${STUB_DIRTY:-}" ] && [ "$PWD" = "$STUB_DIRTY" ] && echo changed >> tracked.txt
[ "$PWD" = "${STUB_FAIL:-}" ] && [[ "$*" == *--audit* ]] && exit 1
exit 0
EOF
cat > "$T/bin/curl" <<'EOF'
#!/usr/bin/env bash
printf 'CURL %s\n' "$*" >> "$STUB_CURL"
EOF
chmod +x "$T/bin/"*
for n in opted dirty plain; do
  git -C "$T" init -q "$n"; echo x > "$T/$n/tracked.txt"
  git -C "$T/$n" add tracked.txt; git -C "$T/$n" -c user.email=t@t -c user.name=t commit -qm init
done
echo '{"armed":true,"test_cmd":"true"}' > "$T/opted/.swarm.json"
echo '{"armed":false,"test_cmd":"true"}' > "$T/dirty/.swarm.json"

export STUB_CALLS="$T/calls" STUB_CURL="$T/curl" STUB_DIRTY="$T/dirty" STUB_FAIL="$T/dirty"
# never let this test reach the real claude or real repos
[ "$(PATH="$T/bin:$PATH" command -v claude)" = "$T/bin/claude" ] || { echo "FAIL: stub claude not first on PATH"; exit 1; }
grep -q 'SWARM_REPOS' "$HERE/swarm_nightly.sh" || { echo "FAIL: script ignores SWARM_REPOS; refusing to run it"; exit 1; }
PATH="$T/bin:$PATH" SWARM_NTFY_TOPIC=https://ntfy.example/t SWARM_NIGHTLY_LOG="$T/log" \
  SWARM_REPOS="$T/opted $T/dirty $T/plain" bash "$HERE/swarm_nightly.sh"

fail() { echo "FAIL: $*"; exit 1; }
# only opted-in repos, exactly audit then dry-run, never a bare /swarm
[ "$(grep -c "^$T/opted|" "$T/calls")" = 2 ] || fail "opted repo not called twice"
[ "$(grep -c "^$T/plain|" "$T/calls" || true)" = 0 ] || fail "repo without .swarm.json was run"
grep -q "^$T/opted|-p /swarm --audit " "$T/calls" || fail "no audit call"
grep -q "^$T/opted|-p /swarm --dry-run " "$T/calls" || fail "no dry-run call"
grep -vE '\|-p /swarm --(audit|dry-run) ' "$T/calls" && fail "an implement-capable call was made"
# every call has a permission mode and blocks pushes; only the dry-run blocks issue creation
grep -v -- '--permission-mode auto' "$T/calls" && fail "call without permission mode"
# headless -p kills background workflows after 600 s; the ceiling is raised but stays finite
grep -v '|wait=7200000$' "$T/calls" && fail "call without the 2 h CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS"
grep -v 'Bash(git push:\*)' "$T/calls" && fail "call without push block"
grep -- '--audit' "$T/calls" | grep -q 'gh issue create' && fail "audit cannot file findings"
grep -- '--dry-run' "$T/calls" | grep -q 'Bash(gh issue create:\*)' || fail "dry-run may create issues"
# one digest naming each repo's tree state
[ "$(grep -c '^CURL ' "$T/curl")" = 1 ] || fail "expected one ntfy post"
grep -q 'opted: tree unchanged' "$T/curl" || fail "clean repo not reported unchanged"
grep -q 'dirty: tree CHANGED' "$T/curl" || fail "dirtied repo not reported"
grep -q 'plain: skipped' "$T/curl" || fail "skip not reported"
# a failed pass must reach the push notification, not just the log
grep -q 'dirty: tree CHANGED, audit FAILED$' "$T/curl" || fail "failed audit missing from digest"
grep -q 'opted:.*FAILED' "$T/curl" && fail "clean repo reported as failed"
echo OK
