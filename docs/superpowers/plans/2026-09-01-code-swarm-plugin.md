# code-swarm Plugin — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:subagent-driven-development or superpowers-extended-cc:executing-plans to implement task-by-task. Steps use checkbox (`- [ ]`) syntax. Execution tooling for THIS plan is the hybrid the user chose: **mattpocock-skills:tdd** per task, **mattpocock-skills:code-review** on each diff before commit.

**Goal:** Generalize the working AutoCrate issue-swarm into a reusable `code-swarm` plugin (in the user's `cc-config` marketplace) that any repo opts into with a small `.swarm.json`, keeping the uniform gate (only `agent-ready` runs autonomously, human always merges), proven first on `daily-operating-system` and migrating AutoCrate last.

**Architecture:** The 10 generic agents + `swarm.js` + `/swarm` skill move into one plugin. Per-repo specifics (repo path, test command, branch, labels, conventions doc, security-scan command, languages) stop being hardcoded and become a `.swarm.json` at the repo root. The `/swarm` skill's pre-flight reads and validates that file, refuses to write unless `armed: true`, and passes the config into the Workflow, which injects a CONFIG block into every agent prompt. Agents read the CONFIG block instead of literal `pytest`/`.venv`/`bandit`. The 4 domain agents (`performance-optimizer`, `debugging-agent`, `audio-domain-expert`, `pipeline-architect`) stay local to AutoCrate.

**Tech Stack:** Claude Code plugin (marketplace `directory` source at `/Users/montrose/cc-config`), Workflow tool JS (`swarm.js`), agent markdown, `gh` CLI, git worktrees, launchd + ntfy for the nightly.

**Known accepted dependency (user decision):** agents invoke the user's global skills (`ponytail`, `tdd`, `security-review`, `caveman-review`, LSP, context7). This is deliberate now; a self-contained fallback (if those plugins ever vanish) is a `ponytail:`-tagged future-hardening item, NOT built in v1.

**Phasing:**
- **v1 (prove it):** Task 1–4 — plugin scaffolded, config-driven, dayos onboarded and dry-run-green.
- **v1.1:** Task 5 (nightly inspect-only) + Task 6 (migrate AutoCrate off its inline swarm).
- **v1.2 (article additions, spec `2026-09-23-universal-harness-design.md`):** Task 7 (`product-planner` + `--build`) + Task 8 (`app` evaluator lens in `pr-verifier`). Both depend on Task 4 only; run before Task 6 so AutoCrate migrates onto the finished plugin.
- **v1.3 (Jev gates, spec Addition 3):** Task 9 — `jev.py` CLI + batteries + gates 1–4 in shadow mode. Depends on Tasks 4, 7, 8 (gates 1 and 4 hook agents those tasks produce).

**Non-goals (deferred):** a generic performance agent (AutoCrate's is domain-bound; generic perf comes via the user's `simplify`/`code-review` skills in `pr-verifier`'s over-engineering lens); arming any repo the user does not own (e.g. upstream `automem`); auto-merge (never).

---

### Task 1: Scaffold the `code-swarm` plugin and parameterize `swarm.js`

**Goal:** A `code-swarm` plugin exists in the `cc-config` marketplace with the 10 generic agents and a `swarm.js` whose AutoCrate-specific constants come from `args.config` instead of hardcoded literals.

**Files:**
- Create: `/Users/montrose/cc-config/code-swarm/.claude-plugin/plugin.json`
- Modify: `/Users/montrose/cc-config/.claude-plugin/marketplace.json` (append plugin entry)
- Create: `/Users/montrose/cc-config/code-swarm/skills/swarm/swarm.js` (from AutoCrate's, parameterized)
- Create: `/Users/montrose/cc-config/code-swarm/skills/swarm/SKILL.md` (Task 2)
- Create: `/Users/montrose/cc-config/code-swarm/agents/*.md` (copy 10 generic agents; decouple in Task 3)

**Acceptance Criteria:**
- [ ] `code-swarm` appears in `claude plugin` marketplace listing for `cc-config`.
- [ ] `swarm.js` has no `/Users/montrose/.../AutoCrate` literal, no `meta.name` = `autocrate-swarm`, no hardcoded `lang` enum, no hardcoded conventions path — all read from `args.config`.
- [ ] `swarm.js` parses and behaves under a stub Workflow runtime (`node --check` cannot: Workflow scripts have a top-level `return`).

**Verify:** `node /Users/montrose/cc-config/code-swarm/scripts/test_swarm.mjs` → `OK`

**Steps:**

- [ ] **Step 1: Copy the generic agents**

```bash
mkdir -p /Users/montrose/cc-config/code-swarm/{agents,skills/swarm}
cd /Users/montrose/Developer/GitRepositories/AutoCrate/.claude/agents
for a in issue-triager issue-groomer issue-implementer pr-verifier security-auditor test-gap-auditor feature-architect issue-filer roadmap-syncer docs-syncer; do
  cp "$a.md" /Users/montrose/cc-config/code-swarm/agents/
done
ls /Users/montrose/cc-config/code-swarm/agents/   # expect 10 files
```
(The 4 domain agents — `performance-optimizer`, `debugging-agent`, `audio-domain-expert`, `pipeline-architect` — are intentionally NOT copied; they stay in AutoCrate.)

- [ ] **Step 2: Write `plugin.json`**

Create `/Users/montrose/cc-config/code-swarm/.claude-plugin/plugin.json`:

```json
{
  "name": "code-swarm",
  "description": "Cross-repo issue swarm: agent-ready GitHub issues become verified PRs (human merges). Opt in per repo with .swarm.json.",
  "version": "0.1.0"
}
```

- [ ] **Step 3: Register in the marketplace**

Read `/Users/montrose/cc-config/.claude-plugin/marketplace.json`, then append to its `plugins` array (keep the existing `cc-config` entry) an entry pointing at the new dir:

```json
{ "name": "code-swarm", "source": "./code-swarm" }
```

- [ ] **Step 4: Copy and parameterize `swarm.js`**

Copy `AutoCrate/.claude/skills/swarm/swarm.js` to `/Users/montrose/cc-config/code-swarm/skills/swarm/swarm.js`, then make these exact edits:

`meta.name` (line 2) → generic:
```js
  name: "code-swarm",
  description: "Turn agent-ready issues into verified PRs; --audit files security/test-gap findings",
```

Replace the hardcoded `REPO` (line 15) and destructure config from `args`:
```js
const {
  issues = [], features = [], dryRun = false, audit = false, docs = false, date = "unknown",
  config = {},
} = args ?? {}
const REPO = config.root ?? "."
const CONV_DOC = config.conventions ?? ""          // e.g. ".claude/skills/<repo>-conventions/SKILL.md" or ""
const TEST_CMD = config.test_cmd ?? "pytest -q"
const MAIN = config.main_branch ?? "main"
const SCA_CMD = config.sca_cmd ?? ""               // e.g. "bandit -q -r ."
const LANGS = config.langs ?? ["python"]
```

Replace the `CONV` string (line 147) with a config-driven block injected into every agent prompt:
```js
const CONV = [
  `Repo root: ${REPO}. Main branch: ${MAIN}.`,
  `Test command: ${TEST_CMD}.`,
  SCA_CMD ? `Security scan command: ${SCA_CMD}.` : `No security scan command configured; skip SCA, note it.`,
  `Languages: ${LANGS.join(", ")}.`,
  CONV_DOC ? `Read ${CONV_DOC} before anything else.` : `No repo conventions doc; follow standard git flow.`,
].join("\n")
```

In `BRIEF_SCHEMA`, change the hardcoded `lang` enum (line 56) to a free string (repos vary):
```js
        lang: { type: "string" },
```
(Leave the rest of the schemas and orchestration unchanged — they are already repo-agnostic; the `${CONV}` prefix now carries the per-repo facts.)

- [ ] **Step 5: Syntax check + commit**

Run: `node --check /Users/montrose/cc-config/code-swarm/skills/swarm/swarm.js && echo OK` → `OK`

```bash
cd /Users/montrose/cc-config
git add code-swarm/.claude-plugin/plugin.json code-swarm/agents code-swarm/skills/swarm/swarm.js .claude-plugin/marketplace.json
git commit -m "feat: scaffold code-swarm plugin, parameterize swarm.js"
```

---

### Task 2: `.swarm.json` schema + the `/swarm` skill pre-flight loader

**Goal:** A repo opts in with a minimal `.swarm.json`; the `/swarm` skill reads it, validates, refuses to write unless `armed: true`, and passes `config` into the Workflow.

**Why:** This is the gate (uniform, dry-run-until-armed) and the source of the per-repo facts Task 1's `swarm.js` now expects.

**Files:**
- Create: `/Users/montrose/cc-config/code-swarm/skills/swarm/SKILL.md`
- Create: `/Users/montrose/cc-config/code-swarm/skills/swarm/swarm.schema.json` (reference schema)

**Acceptance Criteria:**
- [ ] SKILL.md pre-flight resolves the repo root via `git rev-parse --show-toplevel`, reads `.swarm.json`, and errors clearly if absent.
- [ ] A non-`--dry-run`/`--audit` run is refused when `armed` is not `true`.
- [ ] The Workflow launch passes `config` (root, test_cmd, main_branch, labels, conventions, sca_cmd, langs) into `args`.

**Verify:** `jq -e '.armed==false and .test_cmd' /Users/montrose/Developer/GitRepositories/daily-operating-system/.swarm.json` (created in Task 4) → prints the object (after Task 4); for now: `test -f /Users/montrose/cc-config/code-swarm/skills/swarm/swarm.schema.json && echo OK`

**Steps:**

- [ ] **Step 1: Write the reference schema**

Create `/Users/montrose/cc-config/code-swarm/skills/swarm/swarm.schema.json`:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["armed", "test_cmd"],
  "properties": {
    "armed": { "type": "boolean", "description": "false = dry-run/audit only; true = may open PRs" },
    "test_cmd": { "type": "string", "description": "e.g. '.venv/bin/python -m pytest -q'" },
    "main_branch": { "type": "string", "default": "main" },
    "sca_cmd": { "type": "string", "description": "security scan, e.g. 'bandit -q -r src'; omit to skip" },
    "langs": { "type": "array", "items": { "type": "string" }, "default": ["python"] },
    "conventions": { "type": "string", "description": "path to a repo conventions doc, relative to root; omit if none" },
    "labels": {
      "type": "object",
      "properties": {
        "ready": { "type": "string", "default": "agent-ready" },
        "feature": { "type": "string", "default": "feature" },
        "pr_open": { "type": "string", "default": "pr-open" },
        "design_review": { "type": "string", "default": "design-review" },
        "needs_human": { "type": "string", "default": "needs-human" },
        "found": { "type": "string", "default": "swarm-found" }
      }
    }
  }
}
```

- [ ] **Step 2: Write the `/swarm` SKILL.md**

Create `/Users/montrose/cc-config/code-swarm/skills/swarm/SKILL.md`. Base it on AutoCrate's swarm SKILL.md but replace the hardcoded pre-flight with a config-driven one. The frontmatter:

```markdown
---
name: swarm
description: Run the code-swarm on the current repo — agent-ready GitHub issues become verified PRs (human merges). Flags: --dry-run (triage only), --audit (security + test-gap only), --docs, --issue N. Requires a .swarm.json at the repo root. Use on "/swarm", "run the swarm", "process the issue queue", "audit the repo".
---
```

The pre-flight body (replaces AutoCrate SKILL.md lines 13-24):

````markdown
## 1. Parse flags
`--dry-run`, `--audit`, `--docs`, one or more `--issue N`. Unknown flag → stop.

## 2. Pre-flight (bash). Any failure → print reason, stop.
```bash
ROOT="$(git rev-parse --show-toplevel)" || { echo "PRE-FLIGHT: not in a git repo"; exit 1; }
cd "$ROOT"
[ -f .swarm.json ] || { echo "PRE-FLIGHT: no .swarm.json — repo has not opted in"; exit 1; }
ARMED=$(jq -r '.armed // false' .swarm.json)
TEST_CMD=$(jq -r '.test_cmd' .swarm.json)
MAIN=$(jq -r '.main_branch // "main"' .swarm.json)
READY=$(jq -r '.labels.ready // "agent-ready"' .swarm.json)
gh auth status >/dev/null 2>&1 || { echo "PRE-FLIGHT: gh not authenticated"; exit 1; }
if [ "$DRY_RUN" != "1" ] && [ "$AUDIT" != "1" ]; then
  [ "$ARMED" = "true" ] || { echo "PRE-FLIGHT: .swarm.json armed=false — dry-run/audit only until you arm this repo"; exit 1; }
  [ -z "$(git status --porcelain | grep -v '^??')" ] || { echo "PRE-FLIGHT: tracked changes in working tree"; exit 1; }
  [ "$(git branch --show-current)" = "$MAIN" ] || { echo "PRE-FLIGHT: not on $MAIN"; exit 1; }
  git pull -q origin "$MAIN"
fi
eval "$TEST_CMD" 2>&1 | tail -1 | grep -q -E ' passed|OK' || { echo "PRE-FLIGHT: baseline red ($TEST_CMD)"; exit 1; }
echo "PRE-FLIGHT OK (armed=$ARMED)"
```

## 3. Build queue
Use the label from `.swarm.json` (`$READY`, default `agent-ready`), else the same `gh issue list` logic as before, scoped to the current repo (no `-R` needed; `gh` uses the origin).

## 4. Launch
```
Workflow({
  scriptPath: "<this plugin>/skills/swarm/swarm.js",
  args: { issues: [...], features: [...], dryRun, audit, docs, date: "<today>",
          config: { root: "<ROOT>", test_cmd: "<TEST_CMD>", main_branch: "<MAIN>",
                    sca_cmd: "<.swarm.json sca_cmd>", langs: [...], conventions: "<...>",
                    labels: { ready: "<READY>", ... } } }
})
```
Wait for the completion notification; do not poll.

## 5. Summary / 6. After a run
(Same tables and worktree-cleanup guidance as the AutoCrate swarm SKILL.md — copy those sections verbatim; they are already repo-agnostic. Do not merge PRs; human merges.)
````

- [ ] **Step 3: Verify + commit**

Run: `test -f /Users/montrose/cc-config/code-swarm/skills/swarm/swarm.schema.json && echo OK` → `OK`

```bash
cd /Users/montrose/cc-config
git add code-swarm/skills/swarm/SKILL.md code-swarm/skills/swarm/swarm.schema.json
git commit -m "feat: .swarm.json schema + config-driven /swarm pre-flight"
```

---

### Task 3: Decouple the generic agents from AutoCrate specifics

**Goal:** The copied agents read the injected CONFIG block (test command, branch, conventions, SCA) instead of hardcoded `.venv`/`python3 -m pytest`/`bandit`/`autocrate-conventions`, so they run on any configured repo.

**Why:** Sub-agent found `issue-implementer`, `pr-verifier`, `security-auditor`, `docs-syncer`, `issue-triager` carry inline Python/venv/bandit assumptions. Left as-is they only work on AutoCrate.

**Files (in `/Users/montrose/cc-config/code-swarm/agents/`):**
- Modify: `issue-implementer.md`, `pr-verifier.md`, `security-auditor.md`, `docs-syncer.md`, `issue-triager.md`

**Acceptance Criteria:**
- [ ] No agent in the plugin references `.venv/bin/activate`, `PYTHONPATH=src`, `python3 -m pytest`, `bandit`, `autocrate`, or `.claude/skills/autocrate-conventions` as a literal instruction. (Grep clean.)
- [ ] Each references "the Test command from your CONFIG block" / "the Security scan command from your CONFIG block" / "the conventions doc named in your CONFIG block, if any."

**Verify:** `! grep -rEln '\.venv/bin/activate|python3 -m pytest|autocrate-conventions|PYTHONPATH=src' /Users/montrose/cc-config/code-swarm/agents/ && echo CLEAN` → `CLEAN`

**Steps:**

- [ ] **Step 1: Worked example — `issue-implementer.md`**

In `code-swarm/agents/issue-implementer.md`, replace the AutoCrate `## Setup` step 1 and 3 (currently lines 13, 15) with:

```markdown
1. Read the conventions doc named in your CONFIG block, if one is given.
3. Prepare the environment per the repo's norms, then run tests using the **Test command from your CONFIG block** (call it `TEST_CMD` below). If the CONFIG block names a language needing a step before tests (e.g. a venv activate, a build), do it; otherwise just run `TEST_CMD`.
```

In `## Work`, replace literal `python3 -m pytest -q` (line 38) with `TEST_CMD` and drop the `brief.targeted_pytest` Python framing to "the brief's targeted test selector". Replace the `lang: swift` special-case (line 18) with: "If the brief's `lang` needs a different test/build invocation than `TEST_CMD`, use the one the CONFIG block or brief specifies." Keep every git/gh/ponytail rule unchanged (those are repo-agnostic). Replace the hardcoded PR-url example slug in the Output JSON (line 57) with a placeholder `https://github.com/<owner>/<repo>/pull/N`.

- [ ] **Step 2: Worked example — `pr-verifier.md`**

In `code-swarm/agents/pr-verifier.md`:
- `## Setup` (lines 13-14): conventions doc → "from CONFIG"; `source .venv/bin/activate` / `PYTHONPATH=src` → "prepare env per repo norms".
- `## Checks` Suite (line 20): `python3 -m pytest -q` → `the Test command from your CONFIG block`.
- Security (line 22): `bandit ... | pip-audit` → "run the **Security scan command from your CONFIG block** on the changed files (skip if none configured, and note that in reasons)". Keep the `Skill: security-review` invocation (that is a user plugin, deliberately used).
- Perf (line 24): the AutoCrate `analyze.py/convert.py` path list is AutoCrate-specific → replace with "If the diff touches hot paths the repo's conventions flag, apply an efficiency lens." Keep the over-engineering lens verbatim.

- [ ] **Step 3: The remaining three (targeted edits)**

- `security-auditor.md`: replace the inline `bandit`/`pip-audit`/`pip-licenses` Python-SCA stack with "run the **Security scan command from your CONFIG block**; if none, do a manual review of the trust boundaries listed in your instructions and return findings." Keep the finding schema.
- `docs-syncer.md`: remove the 16 hardcoded `AutoCrate`/`AUTOCRATE_*` references and the env-var map; parameterize "the repo's README/CLAUDE.md/conventions" and "the repo's env vars, discovered from its config" — it owns `README.md`/`CLAUDE.md`, `roadmap-syncer` owns `ROADMAP.md`/plans (unchanged split).
- `issue-triager.md`: replace the ~5 `AutoCrate` name refs and inline `pytest` with CONFIG-block phrasing; the `targeted_pytest` brief field is already free-string in the schema now (Task 1) — call it "targeted test selector".

- [ ] **Step 4: Verify + commit**

Run: `! grep -rEln '\.venv/bin/activate|python3 -m pytest|autocrate-conventions|PYTHONPATH=src' /Users/montrose/cc-config/code-swarm/agents/ && echo CLEAN` → `CLEAN`

```bash
cd /Users/montrose/cc-config
git add code-swarm/agents
git commit -m "refactor: config-drive generic swarm agents (de-AutoCrate)"
```

---

### Task 4: Onboard `daily-operating-system` and prove a dry-run

**Goal:** dayos opts in with `.swarm.json` (unarmed), and `/swarm --dry-run` from the plugin triages its open issues without writing anything.

**Why:** Q7a — prove the plugin on the safe pilot before touching AutoCrate's working swarm.

**Files:**
- Create: `/Users/montrose/Developer/GitRepositories/daily-operating-system/.swarm.json`

**Acceptance Criteria:**
- [ ] `.swarm.json` validates against the schema and has `armed: false`.
- [ ] `/swarm --dry-run` from the plugin runs, triages dayos's open issues into briefs/needs-human, and leaves `git status` clean and issue labels unchanged.
- [ ] A non-dry-run `/swarm` is refused with the `armed=false` pre-flight message.

**Verify:** after the dry-run — `cd /Users/montrose/Developer/GitRepositories/daily-operating-system && git status --porcelain | grep -v '^??' | wc -l` → `0`

**Steps:**

- [ ] **Step 1: Write dayos `.swarm.json`**

Create `/Users/montrose/Developer/GitRepositories/daily-operating-system/.swarm.json`:

```json
{
  "armed": false,
  "test_cmd": ".venv/bin/python -m pytest -q",
  "main_branch": "main",
  "sca_cmd": "",
  "langs": ["python"],
  "conventions": "CLAUDE.md"
}
```
(dayos has no `bandit` configured → `sca_cmd` empty; its guardrails-kit lives in `CLAUDE.md` → conventions points there. Test cmd matches its `.venv` from CLAUDE.md.)

- [ ] **Step 2: Validate the config**

```bash
cd /Users/montrose/Developer/GitRepositories/daily-operating-system
jq -e '.armed==false and (.test_cmd|type=="string")' .swarm.json && echo VALID
```
Expected: `true` / `VALID`.

- [ ] **Step 3: Dry-run the swarm from the plugin**

Ensure the `code-swarm` plugin is enabled, then from a session in the dayos repo run `/swarm --dry-run`. Confirm the pre-flight prints `PRE-FLIGHT OK (armed=false)`, the run prints a triage table for the open issues, and it returns `{ dryRun: true, briefs, rejected, findings }`.

- [ ] **Step 4: Confirm zero writes**

Run: `cd /Users/montrose/Developer/GitRepositories/daily-operating-system && git status --porcelain | grep -v '^??' | wc -l` → `0`
And spot-check that no issue's labels changed (`gh issue list --state open`).

- [ ] **Step 5: Confirm the arm gate**

Attempt `/swarm` (no flag). Expected: refused with `PRE-FLIGHT: .swarm.json armed=false — dry-run/audit only until you arm this repo`.

- [ ] **Step 6: Commit the opt-in**

```bash
cd /Users/montrose/Developer/GitRepositories/daily-operating-system
git add .swarm.json
git commit -m "chore: opt daily-operating-system into code-swarm (unarmed)"
```

**→ v1 complete: the plugin is proven on a real repo, no writes, gate holds.**

---

### Task 5 (v1.1): Nightly inspect-only run + ntfy digest

**Goal:** Once nightly, launchd runs `/swarm --dry-run --audit` across allowlisted repos, files findings as issues, and pushes one ntfy digest — never writing code.

**Why:** Q5a and the user's standing rule ("maintenance tools inspect-only by default; review report before destructive runs"). Automation reports; the human implements.

**Files:**
- Create: `/Users/montrose/cc-config/code-swarm/scripts/swarm_nightly.sh`
- Create: `~/Library/LaunchAgents/com.montrose.swarm-nightly.plist`

**Acceptance Criteria:**
- [ ] The script discovers opted-in repos (those with a `.swarm.json`) from a fixed allowlist and runs audit+dry-run per repo headless (`claude -p`), non-interactive.
- [ ] It posts one ntfy digest summarizing findings counts per repo.
- [ ] It never runs an armed/implement pass and leaves every repo's `git status` clean.

**Verify:** `bash -n /Users/montrose/cc-config/code-swarm/scripts/swarm_nightly.sh && echo OK` → `OK`; first real run: inspect `/tmp/swarm-nightly.log` shows audit-only and clean trees.

**Steps:**

- [ ] **Step 1: Write the nightly script**

Create `/Users/montrose/cc-config/code-swarm/scripts/swarm_nightly.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail
REPOS=(
  "/Users/montrose/Developer/GitRepositories/daily-operating-system"
  # add AutoCrate here after Task 6 migration
)
TOPIC="${SWARM_NTFY_TOPIC:?set SWARM_NTFY_TOPIC}"
LOG=/tmp/swarm-nightly.log
: > "$LOG"
summary=""
for r in "${REPOS[@]}"; do
  [ -f "$r/.swarm.json" ] || { echo "skip (no .swarm.json): $r" >>"$LOG"; continue; }
  name=$(basename "$r")
  # headless, audit + dry-run ONLY — never armed
  ( cd "$r" && claude -p "/swarm --audit" >>"$LOG" 2>&1 ) || echo "audit failed: $name" >>"$LOG"
  ( cd "$r" && claude -p "/swarm --dry-run" >>"$LOG" 2>&1 ) || echo "triage failed: $name" >>"$LOG"
  dirty=$(cd "$r" && git status --porcelain | grep -v '^??' | wc -l | tr -d ' ')
  summary+="${name}: dirty=${dirty}"$'\n'
done
curl -s -H "Title: swarm nightly" -d "$summary" "$TOPIC" >/dev/null || true
echo "$summary" >>"$LOG"
```

`# ponytail: findings-count parsing is left to the digest reader; scrape counts from $LOG later if the one-line dirty check proves too coarse.`

- [ ] **Step 2: Make it executable + syntax check**

```bash
chmod +x /Users/montrose/cc-config/code-swarm/scripts/swarm_nightly.sh
bash -n /Users/montrose/cc-config/code-swarm/scripts/swarm_nightly.sh && echo OK
```
Expected: `OK`.

- [ ] **Step 3: Write the LaunchAgent**

Create `~/Library/LaunchAgents/com.montrose.swarm-nightly.plist` (runs 03:00 daily; set `SWARM_NTFY_TOPIC`):

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>com.montrose.swarm-nightly</string>
  <key>ProgramArguments</key>
  <array>
    <string>/Users/montrose/cc-config/code-swarm/scripts/swarm_nightly.sh</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict><key>SWARM_NTFY_TOPIC</key><string>REPLACE_WITH_YOUR_NTFY_TOPIC_URL</string></dict>
  <key>StartCalendarInterval</key><dict><key>Hour</key><integer>3</integer><key>Minute</key><integer>0</integer></dict>
  <key>StandardOutPath</key><string>/tmp/swarm-nightly.out</string>
  <key>StandardErrorPath</key><string>/tmp/swarm-nightly.err</string>
</dict></plist>
```

- [ ] **Step 4: Load + one manual dry test**

```bash
launchctl load ~/Library/LaunchAgents/com.montrose.swarm-nightly.plist
SWARM_NTFY_TOPIC="<your topic>" /Users/montrose/cc-config/code-swarm/scripts/swarm_nightly.sh
grep -c 'dirty=0' /tmp/swarm-nightly.log   # every repo should be clean
```
Expected: count equals the number of allowlisted repos (all clean — audit never writes).

- [ ] **Step 5: Commit**

```bash
cd /Users/montrose/cc-config
git add code-swarm/scripts/swarm_nightly.sh
git commit -m "feat: nightly inspect-only swarm + ntfy digest"
```
(The plist lives in `~/Library/LaunchAgents`, outside the repo — not committed; note it in the plugin README.)

DONE 2026-09-25: LaunchAgent loaded (03:00, random ntfy.sh topic saved in ~/.config/swarm-ntfy-topic). First run via `launchctl kickstart`: exit 0, dayos audit filed #20-#27, both trees unchanged, digest delivered. AutoCrate was skipped (local checkout predated the #116 merge; pulled since). `claude -p` resolves plugin skills (handoff question answered). Digest now names failed passes; findings counts still deferred (ponytail note).

---

### Task 6 (v1.1): Migrate AutoCrate onto the plugin

**Goal:** AutoCrate uses the plugin's swarm via a `.swarm.json`; its inline generic swarm (`.claude/skills/swarm` + the 10 generic agent copies) is deleted, keeping only the 4 domain agents. `/swarm` from the plugin runs green on AutoCrate.

**Why:** Q7a — migrate last, once the plugin is proven. One clean diff, working system never left broken mid-flight.

**Files (in AutoCrate):**
- Create: `.swarm.json`
- Delete: `.claude/skills/swarm/` (now provided by the plugin)
- Delete: the 10 generic agents from `.claude/agents/` (keep `performance-optimizer`, `debugging-agent`, `audio-domain-expert`, `pipeline-architect`)

**Acceptance Criteria:**
- [ ] AutoCrate `.swarm.json` has AutoCrate's real values (`armed: true`, its pytest+venv test cmd, `bandit` sca, `langs: [python, swift]`, conventions path).
- [ ] The 4 domain agents remain; the 10 generic ones are gone from AutoCrate.
- [ ] `/swarm --dry-run` from the plugin, run in AutoCrate, triages its 25 issues green and leaves the tree clean.

**Verify:** `ls /Users/montrose/Developer/GitRepositories/AutoCrate/.claude/agents/ | wc -l` → `4`; and after a plugin dry-run, `cd AutoCrate && git status --porcelain | grep -v '^??' | wc -l` → `0`

**Steps:**

- [ ] **Step 1: Write AutoCrate `.swarm.json`**

Create `/Users/montrose/Developer/GitRepositories/AutoCrate/.swarm.json`:

```json
{
  "armed": true,
  "test_cmd": "source .venv/bin/activate && PYTHONPATH=src python3 -m pytest -q",
  "main_branch": "main",
  "sca_cmd": "bandit -q -r src",
  "langs": ["python", "swift"],
  "conventions": ".claude/skills/autocrate-conventions/SKILL.md"
}
```

- [ ] **Step 2: Dry-run BEFORE deleting anything (safety)**

Run `/swarm --dry-run` from the plugin in AutoCrate. Confirm `PRE-FLIGHT OK (armed=true)`, a green triage table across its issues, tree clean. If this fails, STOP and fix the plugin — do not delete AutoCrate's working swarm yet.

- [ ] **Step 3: Paste-and-confirm the deletion set (guardrail)**

List exactly what will be removed and confirm with the user before deleting (repo CLAUDE.md hard-stop on deletions):
```bash
ls /Users/montrose/Developer/GitRepositories/AutoCrate/.claude/skills/swarm/
for a in issue-triager issue-groomer issue-implementer pr-verifier security-auditor test-gap-auditor feature-architect issue-filer roadmap-syncer docs-syncer; do echo ".claude/agents/$a.md"; done
```

- [ ] **Step 4: Delete the now-duplicated inline swarm**

```bash
cd /Users/montrose/Developer/GitRepositories/AutoCrate
git rm -r .claude/skills/swarm
for a in issue-triager issue-groomer issue-implementer pr-verifier security-auditor test-gap-auditor feature-architect issue-filer roadmap-syncer docs-syncer; do git rm ".claude/agents/$a.md"; done
ls .claude/agents/   # expect exactly the 4 domain agents
```

- [ ] **Step 5: Re-verify from the plugin, then commit**

Run `/swarm --dry-run` from the plugin in AutoCrate again → still green, tree clean.
Run: `ls .claude/agents/ | wc -l` → `4`

```bash
git add .swarm.json
git commit -m "refactor: migrate AutoCrate onto code-swarm plugin"
```
(Human merges any PRs the swarm later opens — unchanged.)

DONE 2026-09-24 as AutoCrate PR #116 (branch refactor/migrate-to-code-swarm; a pre-push hook blocks direct pushes to main). Deletion list confirmed by the user first. Proof: plugin took #108 end to end (PR #111, merged); after deletion a bare `/swarm --dry-run --issue 85` resolved to the plugin, pre-flight OK (armed=true), no writes. `.claude/agents/` = 4 on the branch. test_cmd uses the venv's python directly (the worktree guard refuses `source`).

---

### Task 7 (v1.2): `product-planner` agent + `/swarm --build "<prompt>"`

**Goal:** A 1–4 sentence prompt becomes `docs/specs/<date>-<slug>.md` on a `spec/<slug>` branch + PR, and one unlabeled issue-ready issue per feature. No code written; human labels `agent-ready`.

**Why:** Article's planner closed the under-scoping gap ("given the raw prompt, the generator under-scoped"). Feeding issues instead of a continuous generator keeps the uniform human gate (user decision 2026-09-23).

**Files:**
- Create: `/Users/montrose/cc-config/code-swarm/agents/product-planner.md`
- Modify: `/Users/montrose/cc-config/code-swarm/agents/issue-groomer.md` (build mode: accept `spec_path` + feature number; link spec anchor + `depends_on` issues in body)
- Modify: `/Users/montrose/cc-config/code-swarm/skills/swarm/swarm.js` (`build` mode + `PLAN_SCHEMA`)
- Modify: `/Users/montrose/cc-config/code-swarm/skills/swarm/SKILL.md` (`--build` flag, gate, summary)

**Acceptance Criteria:**
- [ ] `product-planner.md` forbids file paths / function names / line-level steps in the spec and requires overview, numbered features with user stories, data model sketch, high-level tech design, dependency order.
- [ ] `--build` refused when `.swarm.json` absent or `docs/specs/*-<slug>.md` exists; allowed when `armed: false`.
- [ ] `swarm.js` `build` mode: planner → groomer per feature (sequential, dependency order) → returns `{ spec_path, pr_url, issues: [{number, title, feature}], unfiled: [...] }`.
- [ ] Groomer files issues **unlabeled** (or `feature` for design questions); never `agent-ready`.
- [ ] `node --check swarm.js` passes.

**Verify:** `node --check /Users/montrose/cc-config/code-swarm/skills/swarm/swarm.js && echo OK && grep -c -- '--build' /Users/montrose/cc-config/code-swarm/skills/swarm/SKILL.md` → `OK` then a count ≥ 3.

**Steps:**

- [ ] **Step 1: Write `product-planner.md`**

Frontmatter: `name: product-planner`, `model: fable`, `tools: Read, Grep, Glob, Bash, Write`. Body per spec Addition 1: read `CLAUDE.md`/`README.md`/`ROADMAP.md` if present; brownfield fits existing stack and invariants, greenfield picks the smallest stack and says why; write `docs/specs/<YYYY-MM-DD>-<slug>.md` with Overview / Features (numbered `## Feature n: <title>`, user stories, data model sketch) / High-level technical design; NO file paths, function names, or line-level steps; ambitious scope, every feature a single-PR unit, dependency-ordered; AI features only where they serve the product. Then `git checkout -b spec/<slug>`, commit the spec, push, `gh pr create --title "spec: <slug>"`. Output JSON `{ spec_path, pr_url, features: [{n, title, depends_on: []}], findings: [] }`.

- [ ] **Step 2: Extend `issue-groomer.md`**

Add: "BUILD MODE: prompt gives `spec_path` and feature `n`. Read only that feature's section. Produce one issue-ready issue. Body starts with `Spec: <spec_path>#feature-<n>` and one `Depends on: #<issue>` line per number passed in the prompt. CREATE immediately (non-interactive). Labels: none, or `feature` when the section is a design question with more than one reasonable approach." Output JSON `{ created: [{number, title}], skipped_duplicate: [] }` (reuses `FILER_SCHEMA`).

- [ ] **Step 3: `swarm.js` build mode**

Destructure `build = ""` from `args`. Add `PLAN_SCHEMA` (`spec_path` string, `pr_url` string, `features` array of `{n, title, depends_on}`, `findings`). Add a branch before `audit`:

```js
if (build) {
  phase("Plan")
  const plan = await agent(`${CONV}\nToday is ${date}. PROMPT:\n${build}\nWrite the product spec per your instructions, open the spec PR, and return the plan JSON.`,
    { label: "plan:spec", phase: "Plan", agentType: "product-planner", schema: PLAN_SCHEMA, effort: "high", isolation: "worktree" })
  if (!plan || !plan.spec_path) return { build: true, error: "planner returned no spec", prompt: build }
  collect(plan)
  phase("File")
  const filed = {}   // feature n → issue number
  const issues = [], unfiled = []
  for (const f of plan.features) {          // sequential: depends_on needs earlier numbers
    const deps = (f.depends_on ?? []).map(d => filed[d]).filter(Boolean)
    const r = await agent(`${CONV}\nBUILD MODE. spec_path: ${plan.spec_path}. feature: ${f.n} (${f.title}). depends_on issues: ${deps.join(", ") || "none"}. File it per your instructions.`,
      { label: `file:f${f.n}`, phase: "File", agentType: "issue-groomer", schema: FILER_SCHEMA, effort: "medium" })
    const c = r?.created?.[0]
    if (c) { filed[f.n] = c.number; issues.push({ ...c, feature: f.n }) }
    else unfiled.push({ feature: f.n, title: f.title, anchor: `${plan.spec_path}#feature-${f.n}` })
  }
  return { build: true, spec_path: plan.spec_path, pr_url: plan.pr_url ?? "", issues, unfiled, findings }
}
```
`// ponytail: sequential filing so depends_on can cite real issue numbers; two-pass (create, then edit bodies) if a spec ever has >30 features.`
Add `{ title: "Plan", detail: "product-planner writes docs/specs/<slug>.md" }` to `meta.phases`.

- [ ] **Step 4: SKILL.md `--build`**

Flag parse: `--build "<prompt>"` is standalone (any other flag alongside → stop). Pre-flight for build: `.swarm.json` present, `gh auth`, clean tree, on `$MAIN`, pull; `armed` NOT required (no code is written). Slug = kebab-case of the prompt's first 5 words; refuse if `ls docs/specs/*-<slug>.md` matches. Launch with `args: { build: "<prompt>", date, config }`. Summary: table `feature | issue | title`, then `unfiled` rows with their spec anchor, then the spec PR URL, then the line "Label `agent-ready` on the issues you want built, then run `/swarm`."

- [ ] **Step 5: Syntax check + commit**

Run: `node --check /Users/montrose/cc-config/code-swarm/skills/swarm/swarm.js && echo OK` → `OK`

```bash
cd /Users/montrose/cc-config
git add code-swarm/agents/product-planner.md code-swarm/agents/issue-groomer.md code-swarm/skills/swarm/swarm.js code-swarm/skills/swarm/SKILL.md
git commit -m "feat(code-swarm): product-planner + /swarm --build"
```

- [ ] **Step 6: Prove on daily-operating-system (unarmed)**

From a dayos session: `/swarm --build "todo list with tags and a daily digest"`. Expect: spec PR open on `spec/todo-list-with-tags-and`, N unlabeled issues each starting `Spec: docs/specs/…#feature-n`, `git status --porcelain | grep -v '^??' | wc -l` on main → `0`. Rerun same prompt → refused (slug exists). Close the test issues and PR afterwards unless useful.

DONE 2026-09-24 on AutoCrate instead (user switched pilots; dayos's no-push rule stopped the planner): spec PR #112 + unlabeled issues #113-#115, each with a working `#feature-n` blob link and `Depends on` lines; same-slug rerun refused; all closed and spec branch deleted. Planner finding worth keeping: genre is dropped at intake (not stored, not written, not synced) — see closed #113.

---

### Task 8 (v1.2): `app` evaluator lens in `pr-verifier`

**Goal:** When `.swarm.json` has an `app` block, the verifier starts the app in the worktree and drives it with Playwright against every brief test and issue acceptance line; any failing criterion → `changes_requested`. Without `app`, behavior is unchanged.

**Why:** Article: "Out of the box, Claude is a poor QA agent" — tests passed while the central feature did not work. A separate, skeptical evaluator exercising the live product is the load-bearing piece for web repos.

**Files:**
- Modify: `/Users/montrose/cc-config/code-swarm/skills/swarm/swarm.schema.json` (`app` block)
- Modify: `/Users/montrose/cc-config/code-swarm/agents/pr-verifier.md` (lens section)
- Modify: `/Users/montrose/cc-config/code-swarm/skills/swarm/SKILL.md` (pass `app` through `config`)
- Modify: `/Users/montrose/cc-config/code-swarm/skills/swarm/swarm.js` (CONV line for app)

**Acceptance Criteria:**
- [ ] Schema: optional `app: { start_cmd (string, required), url (string, required), ready_wait_s (integer, default 10) }`.
- [ ] `CONV` gains `App: start with "<start_cmd>", url <url>, wait <n>s before testing.` when configured, else `No app block; skip the live-app lens.`
- [ ] `pr-verifier.md` has a `## Live-app lens (only when CONFIG names an app)` section: start in background, PID via `lsof -ti :PORT` (never image name), `Skill: example-skills:webapp-testing`, walk every `brief.tests[].asserts` + issue Acceptance line as a user, screenshot each, the four skeptic rules verbatim, binary threshold, kill by PID, `reasons[]` entries prefixed `app:`.
- [ ] App fails to start or Playwright skill missing → `changes_requested` with an `app:` reason; never approve blind.

**Verify:** `jq -e '.properties.app.properties.start_cmd' /Users/montrose/cc-config/code-swarm/skills/swarm/swarm.schema.json >/dev/null && grep -c 'app:' /Users/montrose/cc-config/code-swarm/agents/pr-verifier.md` → a count ≥ 3.

**Steps:**

- [ ] **Step 1: Schema**

Add to `swarm.schema.json` `properties`:
```json
"app": {
  "type": "object",
  "required": ["start_cmd", "url"],
  "properties": {
    "start_cmd": { "type": "string", "description": "starts the app from repo root, e.g. 'npm run dev'" },
    "url": { "type": "string", "description": "URL that answers when the app is up" },
    "ready_wait_s": { "type": "integer", "default": 10 }
  }
}
```

- [ ] **Step 2: `swarm.js` + SKILL.md plumbing**

`const APP = config.app ?? null`; push onto `CONV`: `APP ? \`App: start with "${APP.start_cmd}", url ${APP.url}, wait ${APP.ready_wait_s ?? 10}s before testing.\` : "No app block; skip the live-app lens."`. SKILL.md pre-flight reads it with `jq -c '.app // empty' .swarm.json` and passes it in `config.app`.

- [ ] **Step 3: `pr-verifier.md` lens section**

Insert after `## Checks`, before `## Verdict`:

```markdown
## Live-app lens (only when CONFIG names an app)
Trigger: diff touches UI/API files, or any `brief.tests[].asserts` / issue Acceptance line describes a user action or URL. Otherwise skip and record `app: lens not triggered` in your notes (not in reasons).
1. From the worktree root run the App start command in the background; wait the configured seconds; `curl -sf <url>` must succeed. Find the PID via the port (`lsof -ti :<port>`); never kill by image name. Cannot start → reason `app: failed to start (<last 5 stderr lines>)`, verdict changes_requested, skip the rest of this section.
2. Invoke `Skill: example-skills:webapp-testing`. Skill unavailable → reason `app: evaluator lens unavailable`, changes_requested.
3. For every `brief.tests[].asserts` and every issue Acceptance line: perform it as a user would (click, type, submit, read the DOM, call the endpoint, inspect state). Screenshot each; keep the paths.
4. Skeptic rules — follow literally:
   - An issue you identify is a finding. Do not decide it "isn't a big deal" and approve. Report it; the human decides.
   - Test the edge case and the second path, not only the happy path.
   - Display-only or stubbed behavior where the criterion says interactive = FAIL.
   - Each failure names the criterion, the observed behavior, and file:line when known.
5. Any FAIL → `changes_requested`. Each failure is one `reasons[]` entry: `app: <criterion> — FAIL — <observed> (<file:line>, <screenshot path>)`.
6. Kill the app by PID. Confirm `git status --porcelain` in the worktree is unchanged by the run.
```

- [ ] **Step 4: Verify + commit**

Run the Verify command above.
```bash
cd /Users/montrose/cc-config
git add code-swarm/skills/swarm/swarm.schema.json code-swarm/skills/swarm/swarm.js code-swarm/skills/swarm/SKILL.md code-swarm/agents/pr-verifier.md
git commit -m "feat(code-swarm): live-app evaluator lens in pr-verifier"
```

- [ ] **Step 5: Prove the lens both ways**

Pick a web repo with `.swarm.json`; add `app`. Use an issue whose acceptance is a button the implementation deliberately leaves unwired. `/swarm --issue N` → verifier `changes_requested` with an `app:` reason and screenshot path. Remove `app` → rerun → approves on tests alone. Record both PR comment URLs below this step.

DEFERRED (user decision 2026-09-24): needs an armed web repo chosen by the user; lens built and stub-tested, live proof pending.

---

### Task 9 (v1.3): Jev gates — `jev.py`, batteries, shadow mode

**Goal:** Four cheap calibrated gates (spec Addition 3) run in shadow mode around the swarm's agents, logging Jev's judgment beside what the agent did. No gate changes behavior until `.swarm.json` `jev.mode` is `"enforce"`. Key missing or API error → fail open.

**Why:** Turns the article's "evaluator talks itself out of findings" and the swarm's Fable-triage spend into ~150 ms typed judgments code can threshold. Shadow first because every threshold is a guess until logged against this user's issues.

**Prereq (human):** `TYPESAFE_API_KEY` in `~/.config/typesafe/.env` (see Step 0). Done 2026-09-23 on this MacBook via `op` CLI (desktop-app integration enabled that day); smoke test returned `jev-1.13.0`.

**Files:**
- Create: `/Users/montrose/cc-config/code-swarm/scripts/jev.py`
- Create: `/Users/montrose/cc-config/code-swarm/scripts/batteries/{verifier_leniency,issue_pretriage,finding_dedup,feature_sizing}.json`
- Create: `/Users/montrose/cc-config/code-swarm/scripts/test_jev.py` (one runnable check)
- Modify: `/Users/montrose/cc-config/code-swarm/skills/swarm/swarm.schema.json` (`jev` block)
- Modify: `/Users/montrose/cc-config/code-swarm/skills/swarm/SKILL.md` (gate 2 in pre-flight; pass `jev` in `config`)
- Modify: `/Users/montrose/cc-config/code-swarm/skills/swarm/swarm.js` (CONV line naming the CLI + mode; `tier` from gate 2 selects implementer `model`)
- Modify: `/Users/montrose/cc-config/code-swarm/agents/{pr-verifier,issue-filer,product-planner}.md` (call the CLI; obey mode)

**Acceptance Criteria:**
- [ ] `jev.py <battery> <state.json>` prints answers JSON; with no key prints `{"skipped": true, "reason": "no TYPESAFE_API_KEY"}` and exits 0.
- [ ] Every call appends one line to `~/.cache/code-swarm/jev.jsonl` (`ts, repo, gate, mode, state_hash, answers, agent_did`).
- [ ] Schema: optional `jev: { mode: "shadow"|"enforce"|"off", default "shadow" }`.
- [ ] `mode: "off"` → no calls. `"shadow"` → calls + log only. `"enforce"` → rules from the spec table apply.
- [ ] Gate 2 in pre-flight never blocks a run on Jev failure; a skipped gate just means every issue goes to the triager as today.
- [ ] `python3 code-swarm/scripts/test_jev.py` passes offline (fail-open path + threshold logic on canned answers).

**Verify:** `cd /Users/montrose/cc-config && python3 code-swarm/scripts/test_jev.py && echo OK` → `OK`

**Steps:**

- [x] **Step 0 (human): key file** — done 2026-09-23

```bash
# item title has parentheses, which op:// refs reject → use the item ID
mkdir -p ~/.config/typesafe && umask 077 && printf 'export TYPESAFE_API_KEY=%s\n' "$(op read 'op://Private/7g6x3bsucb7ribovvibx7rk4tu/credential')" > ~/.config/typesafe/.env && chmod 600 ~/.config/typesafe/.env
```
Do not add it to `.zshrc`; `jev.py` sources this file itself when the env var is unset, so it also works under launchd (Task 5). Re-run the same line on a new machine.

- [ ] **Step 1: `jev.py`**

Python, stdlib + `typesafe-sdk` (`python3 -m pip install --user typesafe-sdk`; `# ponytail: --user install, move to a venv under ~/.cache/code-swarm if it ever conflicts`). Behavior: load key from env or `~/.config/typesafe/.env`; read battery JSON `{questions: {...}}` and state JSON from argv; call `client.system_one(state=..., questions=...)` with a 10 s timeout; print `answers` as JSON; append log line. Any exception → print `{"skipped": true, "reason": "<class>: <msg>"}`, exit 0. Flags: `--gate <name> --mode <shadow|enforce|off> --agent-did '<json>'` for the log line. Port question wording from `jev-harness/src/jev.ts` (`GUARD_IN.injection`, `ROUTE.difficulty`) into the batteries.

- [ ] **Step 2: batteries**

Four JSON files, questions exactly as the spec table names them. Score levels must describe concrete situations (TypeSafe guidance), e.g. `complexity`: ["one function or one file, mechanical", "several files or one design decision", "cross-cutting, state transitions, or unclear approach"]. Include a no-match outcome where one is possible (`kind` gets `other`).

- [ ] **Step 3: `test_jev.py`**

Offline. Monkeypatch the client to raise → assert `{"skipped": true}` and exit 0. Feed canned answers into the pure threshold functions (`decide_pretriage`, `decide_leniency`, `decide_dedup`, `decide_sizing`, each a plain function in `jev.py`) and assert the spec table's rules: e.g. `has_test=0.2` → `needs_human`; `divergence=0.8, verdict=approve` → `changes_requested`; `same_problem=[0.1, 0.9]` → `dup_of` index 1.

- [ ] **Step 4: wire gate 2 into SKILL.md pre-flight**

After the queue is built: for each issue, `gh issue view N --json title,body` → state file → `jev.py issue_pretriage`. Shadow: print a column `jev` in the queue table (`kind/complexity/risk/tier`). Enforce: apply the spec rules before launch (relabel + comment via `gh`, drop from queue) and pass `tier` per issue in `args.issues` as `[{n, tier}]`. `swarm.js`: accept either bare numbers or `{n, tier}`; implementer `model` = `tier ?? "sonnet"`.

- [ ] **Step 5: wire gates 1, 3, 4 into agents**

Add to each agent a short section "## Jev gate (CONFIG names the CLI and mode)": build the state JSON, run the CLI, in shadow do nothing further, in enforce apply the one rule from the spec table. `pr-verifier`: after computing the verdict, before posting. `issue-filer`: per finding before `gh issue create`. `product-planner`: per feature before returning; on `single_pr_unit` < 0.4 split that feature once.

- [ ] **Step 6: schema + CONV plumbing, verify, commit**

`swarm.schema.json` gets the `jev` block; SKILL.md passes `jev.mode` in `config`; `swarm.js` CONV adds `Jev gates: mode <mode>; CLI <plugin>/scripts/jev.py` or `Jev gates off.`
Run: `cd /Users/montrose/cc-config && python3 code-swarm/scripts/test_jev.py && echo OK` → `OK`
```bash
cd /Users/montrose/cc-config
git add code-swarm/scripts code-swarm/skills/swarm code-swarm/agents
git commit -m "feat(code-swarm): Jev gates (shadow mode) + jev.py CLI"
```

- [ ] **Step 7: shadow review after 5 runs**

`python3 -c` one-liner over `~/.cache/code-swarm/jev.jsonl` grouping by gate: rows where Jev's enforce-rule would have differed from `agent_did`. Promote a gate to `enforce` in the pilot repo's `.swarm.json` only when those rows are ones the human agrees with. Record the decision per gate in this plan.

---

## Self-review notes

- **Spec coverage vs the 6-step original ask:** (1) find issues → `issue-triager`/`issue-filer`; (2) complexity/human-or-not → triager sets `agent-ready` vs `needs-human`/`feature`; (3) work safe items via plugins → `issue-implementer` (agent-ready only) invoking ponytail/tdd (Task 3 keeps those); (4) code audit → `pr-verifier` + `test-gap-auditor`; (5) security audit → `security-auditor` + `security-review` skill; (6) optimizations + PRs + git → over-engineering lens + `roadmap/docs-syncer`, PRs opened by implementer, git peculiarities handled in worktrees, never merges. Generic perf agent explicitly deferred (Non-goals).
- **Decision coverage:** 1a plugin (Task 1, `cc-config` marketplace) · 2a opt-in allowlist (`.swarm.json` presence, Task 4) · 3a uniform gate + dry-run-until-armed (Task 2 pre-flight) · 4a minimal schema (Task 2) · 5a inspect-only nightly (Task 5) · 6a bake-in-plugins-now + self-contained-later debt (Architecture note) · 7a prove-on-dayos-first, AutoCrate-last (Tasks 4 then 6).
- **Type/name consistency:** `config.{root,test_cmd,main_branch,sca_cmd,langs,conventions,labels}` used identically in swarm.js (Task 1), SKILL.md launch (Task 2), and every `.swarm.json` (Tasks 4, 6). CONFIG-block phrasing consistent across agents (Task 3).
- **Assumption flagged for execution:** the nightly uses `claude -p "/swarm ..."` headless — confirm the installed Claude Code supports plugin skills in `-p` non-interactive mode before relying on Task 5; if not, the nightly instead calls the Workflow entry directly.
