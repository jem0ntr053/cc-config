---
name: swarm
description: Run the code-swarm on the current repo — agent-ready GitHub issues become verified PRs (human merges). Flags: --dry-run (triage only), --audit (security + test-gap only), --docs, --issue N. Requires a .swarm.json at the repo root. Use on "/swarm", "run the swarm", "process the issue queue", "audit the repo".
---

# /swarm

You are the coordinator. You run bash pre-flight, build the queue, launch the Workflow, and print the summary. You do not implement issues yourself.

## 1. Parse flags
From `$ARGUMENTS`: `--dry-run`, `--audit`, `--docs`, one or more `--issue N`. Unknown flag → stop and say so. `--audit` and `--docs` are standalone modes; combining them with each other or with `--issue` → stop and say so.

## 2. Pre-flight (bash, no agents). Any failure → print reason, stop.
Set `DRY_RUN=1` for `--dry-run` and `AUDIT=1` for `--audit` (else `0`) at the top of the block.
```bash
DRY_RUN=0; AUDIT=0   # set from flags
ROOT="$(git rev-parse --show-toplevel)" || { echo "PRE-FLIGHT: not in a git repo"; exit 1; }
cd "$ROOT"
[ -f .swarm.json ] || { echo "PRE-FLIGHT: no .swarm.json — repo has not opted in"; exit 1; }
jq -e '(.armed|type=="boolean") and (.test_cmd|type=="string")' .swarm.json >/dev/null \
  || { echo "PRE-FLIGHT: .swarm.json needs boolean armed + string test_cmd"; exit 1; }
ARMED=$(jq -r '.armed // false' .swarm.json)
TEST_CMD=$(jq -r '.test_cmd' .swarm.json)
MAIN=$(jq -r '.main_branch // "main"' .swarm.json)
gh auth status >/dev/null 2>&1 || { echo "PRE-FLIGHT: gh not authenticated"; exit 1; }
if [ "$DRY_RUN" != "1" ] && [ "$AUDIT" != "1" ]; then
  [ "$ARMED" = "true" ] || { echo "PRE-FLIGHT: .swarm.json armed=false — dry-run/audit only until you arm this repo"; exit 1; }
  [ -z "$(git status --porcelain | grep -v '^??')" ] || { echo "PRE-FLIGHT: tracked changes in working tree"; exit 1; }
  [ "$(git branch --show-current)" = "$MAIN" ] || { echo "PRE-FLIGHT: not on $MAIN"; exit 1; }
  git pull -q origin "$MAIN"
fi
OUT=$(eval "$TEST_CMD" 2>&1) || { printf '%s\n' "$OUT" | tail -5; echo "PRE-FLIGHT: baseline red ($TEST_CMD)"; exit 1; }
echo "PRE-FLIGHT OK (armed=$ARMED)"
jq -c '{root: $root, test_cmd, main_branch: (.main_branch // "main"), sca_cmd: (.sca_cmd // ""),
        langs: (.langs // ["python"]), conventions: (.conventions // ""),
        labels: ({ready: "agent-ready", feature: "feature", pr_open: "pr-open", design_review: "design-review",
                  needs_human: "needs-human", found: "swarm-found"} + (.labels // {}))}' --arg root "$ROOT" .swarm.json
```
The last line prints the `config` object for step 4 — pass it through verbatim. Dry-run and audit are read-only, so they may run from any branch with a dirty tree (needed to smoke-test before merge). Untracked files are allowed (they are not swept into worktrees). Baseline runs once here; agents run targeted tests plus one full run before opening a PR.

## 3. Build queue
Scoped to the current repo (`gh` uses the origin). Its own bash call, so it re-reads the labels:
```bash
cd "$(git rev-parse --show-toplevel)"
READY=$(jq -r '.labels.ready // "agent-ready"' .swarm.json)
FEATURE=$(jq -r '.labels.feature // "feature"' .swarm.json)
PR_OPEN=$(jq -r '.labels.pr_open // "pr-open"' .swarm.json)
DESIGN_REVIEW=$(jq -r '.labels.design_review // "design-review"' .swarm.json)
gh issue list --label "$READY" --state open --json number,title,labels \
  -q ".[] | select(.labels | map(.name) | index(\"$PR_OPEN\") | not) | \"\\(.number)\\t\\(.title)\""
gh issue list --label "$FEATURE" --state open --json number,title,labels \
  -q ".[] | select(.labels | map(.name) | index(\"$DESIGN_REVIEW\") | not) | \"\\(.number)\\t\\(.title)\""
```
`--issue N` given → queue is exactly those numbers. On a real run they must still carry `$READY` (drop any that don't, and say so). On `--dry-run`, `--issue N` needs no label: nothing is written, so any open issue may be triaged as a preview. `--dry-run` also skips features (design posts comments). `--audit` or `--docs` → queue and features are empty.

Print the queue and features as a table. In an interactive session, ask once: "Launch?" — proceed on yes. Empty queue and empty features and neither `--audit` nor `--docs` → say "nothing to do" and stop.

## 4. Launch
Call the Workflow tool. `scriptPath` is `swarm.js` in this skill's base directory (the "Base directory for this skill" line shown when the skill loaded):
```
Workflow({
  scriptPath: "<base directory>/swarm.js",
  args: { issues: [17, 18], features: [21], dryRun: false, audit: false, docs: false, date: "<today YYYY-MM-DD>",
          config: <object printed by pre-flight> }
})
```
`args` is a JSON object, never a string. Wait for the completion notification; do not poll.

## 5. Summary
When the workflow returns, print:

| issue | status | PR | tests | notes |
|---|---|---|---|---|
| #17 | pr_open | https://… | 344/0 | approved r1 |
| #18 | needs_human | https://… | 343/1 | verify r2: reasons… |

Then `designs: N posted (label design-review)` and `findings: N filed, M duplicates` listing created issue numbers. If `filed.error` is set, print the raw findings so nothing is lost.

For `--dry-run`: print each brief (issue, branch, files, tests) and the rejected list. Confirm `git status --porcelain` is unchanged.

For `--docs`: print one row per syncer:

| agent | status | PR | changes |
|---|---|---|---|
| roadmap-syncer | pr_open | https://… | 2 |
| docs-syncer | unchanged | — | 0 |

then list each `changes` line, and the findings summary as above. `roadmap-syncer` owns `ROADMAP.md`/plan files; `docs-syncer` owns `README.md`/`CLAUDE.md`/conventions — the two PRs never overlap.

Do not merge PRs. Do not relabel anything the workflow did not. Human merges.

## 6. After a run
- Worktrees left by failed implementers live under `.claude/worktrees/`; list them with `git worktree list`. Remove after inspection with `git worktree remove <path>`.
- To resume an interrupted run: `Workflow({scriptPath: ..., resumeFromRunId: "<id from the launch result>"})` — unchanged agents replay from cache.
