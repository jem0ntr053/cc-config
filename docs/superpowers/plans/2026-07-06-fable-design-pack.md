# Fable Design Pack Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:subagent-driven-development (recommended) or superpowers-extended-cc:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the remaining design-pack components in cc-config: session-debrief skill, plugin-routing upgrades (deconflict, effort dial, verification rule), plugin-routing compression, workflow.md checks, and plugin conversion.

**Architecture:** Markdown skills + shell-free config edits, executed by any Opus/Sonnet session without supervision. Every task carries verify commands with expected output. Spec: `docs/superpowers/specs/2026-07-06-fable-design-pack-design.md`. Already done by Fable (do NOT redo): spec, `kit/` vendor + manifest, `prompts/onboard-repo.md`.

**Tech Stack:** Markdown, bash (install.sh), JSON (plugin manifests). No code compilation; "tests" are grep/ls checks plus fresh-session behavioral checks a human runs.

**Conventions:** Work on a feature branch (pre-commit hook blocks main). Commit messages: terse conventional-commit style, no Co-Authored-By trailer (repo rule, `docs/workflow.md`).

**Spec deviation (approved rationale):** The spec named a Stop-hook for the session debrief. Claude Code's `Stop` event fires at EVERY response end, not session end — a hook there nags every turn or requires fragile debounce. Deliverable is instead a user-invoked skill (`session-debrief`) plus a finishing-checklist step in workflow.md. Same ritual, sane trigger.

---

### Task 1: session-debrief skill

**Goal:** End-of-session ritual (least-confident list, biggest-miss, handoff routing) as an invocable skill.

**Files:**
- Create: `skills/session-debrief/SKILL.md`
- Modify: `install.sh` (add symlink line + report line)

**Acceptance Criteria:**
- [ ] Skill file exists with trigger-rich description frontmatter
- [ ] `install.sh` symlinks it and is idempotent (re-run safe)
- [ ] Fresh session: "wrap up" invokes the skill (human check, workflow.md row 14 from Task 4)

**Verify:** `bash install.sh && readlink ~/.claude/skills/session-debrief` → `/Users/montrose/cc-config/skills/session-debrief`

**Steps:**

- [ ] **Step 1: Write the skill**

Create `skills/session-debrief/SKILL.md` with exactly this content:

```markdown
---
name: session-debrief
description: Use when a work session is ending — user says "wrap up", "debrief", "done for today", "ending session", or asks "what are you least confident about". Surfaces unverified assumptions and blind spots, then routes to writing-handoffs if work continues.
---

# Session Debrief

End-of-session ritual. Three steps, in order, no skipping.

## 1. Least confident

Answer honestly: "What am I least confident about right now?"

List 3–7 items. For each: what was not verified, why it matters, and the one
command that would verify it. Flag any item that should block shipping with
**BLOCKER**. An item already verified this session with pasted output does not
belong on the list — this is for gaps, not recap.

## 2. Biggest miss

Answer: "What is the biggest thing the user is missing about the situation?
What don't they realize?"

One paragraph max. Perspective-level gap (wrong assumption, unconsidered
alternative, looming cost) — not a restatement of the item list.

## 3. Route

- Work continues later → invoke the writing-handoffs skill now (handoff doc +
  memory entry, includes `## Recommended Model` for next session's tier pick).
- BLOCKER items exist → offer to investigate now, before the session ends.
- Session truly done, no blockers → summarize in 3 lines and stop.

## When NOT to use

- Mid-session "is this done?" checks — that is verification-before-completion.
- Trivial Q&A sessions with no work product.
```

- [ ] **Step 2: Wire install.sh**

In `install.sh`, after the line `ln -sfn "$SOURCE/skills/writing-handoffs"             "$TARGET/skills/writing-handoffs"`, add:

```bash
ln -sfn "$SOURCE/skills/session-debrief"              "$TARGET/skills/session-debrief"
```

In the report loop at the bottom, extend the list `for link in ...` to include `skills/session-debrief`.

- [ ] **Step 3: Verify**

Run: `bash install.sh && readlink ~/.claude/skills/session-debrief`
Expected: prints the repo path `/Users/montrose/cc-config/skills/session-debrief`; script exits 0 on a second run too.

- [ ] **Step 4: Commit**

```bash
git add skills/session-debrief install.sh
git commit -m "feat(skill): session-debrief — end-of-session confidence audit + handoff routing"
```

---

### Task 2: plugin-routing.md additions (deconflict, effort dial, verification rule, debrief row)

**Goal:** Wire the new pieces into the always-loaded router.

**Files:**
- Modify: `plugin-routing.md`

**Acceptance Criteria:**
- [ ] Kit deconflict section exists and states precedence order
- [ ] Effort-dial defaults table exists
- [ ] Plans-carry-verification rule exists
- [ ] Trigger table has a session-debrief row

**Verify:** `grep -c "session-debrief\|Guardrails-Kit Repos\|Effort Dial\|Plans Carry Verification" plugin-routing.md` → `4` (or more)

**Steps:**

- [ ] **Step 1: Add trigger-table row**

In the Trigger Table's `VERIFICATION & REVIEW` block, after the `finishing-a-dev-branch` row, insert:

```
session-debrief          | session ending, "wrap up"        | 🟢 | mid-session, trivial Q&A
```

- [ ] **Step 2: Add three sections**

Insert immediately before `## Anti-Patterns (Never)`:

```markdown
## Guardrails-Kit Repos (deconflict)

Repo CLAUDE.md has `guardrails-kit:` marker → kit routing (`TRIGGER:` lines, `docs/guardrails/` Reads) runs INSIDE whatever skill is active. Kit = per-repo floor; this file = global router. Precedence on conflict: user's explicit instruction > repo CLAUDE.md/kit rule > this file's defaults. Never suppress a kit `TRIGGER:` line to follow a phase strip — do both.

## Effort Dial (per-turn, cache-free — tier stays locked per session)

```
design / debug / unknown failure   | high
plan execution                     | medium
mechanical edit / rename / format  | low
```

## Plans Carry Verification

Every plan task ships: verify command + expected output. Supervisor tier writes plans and grades results; cheapest tier that passes the verify blocks executes. No verify block = plan not done.
```

- [ ] **Step 3: Verify**

Run: `grep -c "session-debrief\|Guardrails-Kit Repos\|Effort Dial\|Plans Carry Verification" plugin-routing.md`
Expected: `4` or more.

- [ ] **Step 4: Commit**

```bash
git add plugin-routing.md
git commit -m "feat(routing): kit deconflict + effort dial + plans-carry-verification + debrief row"
```

---

### Task 3: plugin-routing.md compression pass

**Goal:** Shrink the always-loaded router with zero semantic loss (kit principle: every always-on line taxes compliance with all others).

**Files:**
- Modify: `plugin-routing.md`

**Acceptance Criteria:**
- [ ] Line count ≤ 110 (was ~129 before Task 2 additions; additions add ~20 — net target: remove ≥ 40 lines of redundancy)
- [ ] Line-accounting table produced: every removed line is DUPLICATE (its surviving twin named) or DECORATION — no rule content dropped
- [ ] All 13 existing lifecycle-check rows in `docs/workflow.md` still pass by inspection (every skill named in a check row still appears in the routing file)

**Verify:** `wc -l plugin-routing.md` → ≤ 110, AND `for s in caveman recall_memory picking-model-tier context7 brainstorming writing-plans executing-plans systematic-debugging verification-before-completion security-review update-config caveman-commit session-debrief; do grep -q "$s" plugin-routing.md || echo "MISSING $s"; done` → no output

**Steps:**

- [ ] **Step 1: Line-account the current file**

Number every non-blank line. Known redundancy targets (verify before cutting): the Phase Strips and the Trigger Table restate the same skill-to-phase mapping — the Trigger Table is canonical; compress the strips to the 4 one-line sequences only. The Always-On Defaults section and the ALWAYS-ON block of the trigger table overlap — keep one. Legend/footnote prose compresses to single lines.

- [ ] **Step 2: Produce the accounting table**

In the commit message body or a scratch comment in the PR description (NOT a repo file), list: `removed line → DUPLICATE of <surviving line> | DECORATION`. One row per removed line.

- [ ] **Step 3: Apply, verify, commit**

Run both Verify commands above. Expected: count ≤ 110, no `MISSING` lines.

```bash
git add plugin-routing.md
git commit -m "refactor(routing): compress always-loaded router, zero semantic loss (accounting in PR)"
```

---

### Task 4: workflow.md updates (lifecycle checks + finishing step + locations)

**Goal:** Human playbook reflects the new system and gains behavioral checks for it.

**Files:**
- Modify: `docs/workflow.md`

**Acceptance Criteria:**
- [ ] Rows 14–16 added to the lifecycle-check table
- [ ] Finishing table gains a debrief step
- [ ] "Where things live" gains kit + prompt rows

**Verify:** `grep -c "session-debrief\|onboard-repo\|kit/" docs/workflow.md` → ≥ 4

**Steps:**

- [ ] **Step 1: Lifecycle-check rows**

Append to the verification table (after row 13):

```markdown
| 14 | Debrief | say "wrap up" at the end of a work session | `session-debrief` fires: least-confident list + biggest-miss + handoff routing |
| 15 | Kit coexistence | start a session in a repo whose CLAUDE.md has the `guardrails-kit:` marker | kit `TRIGGER:` lines fire AND superpowers skills still invoke; no contradictory instructions |
| 16 | Onboarding prompt | paste `~/cc-config/prompts/onboard-repo.md` in a scratch repo | Phase 0 classifier runs; `VERIFICATION 0` block pasted before any discovery |
```

- [ ] **Step 2: Finishing table**

Add a row after "5. Sync":

```markdown
| 6. Debrief | say "wrap up" — `session-debrief` audits confidence, routes to handoff |
```

- [ ] **Step 3: "Where things live" rows**

```markdown
| Guardrails kit (vendored, verbatim) | `~/cc-config/kit/` (upstream + hashes: `kit/MANIFEST.sha`) |
| Repo onboarding prompt | `~/cc-config/prompts/onboard-repo.md` — paste into a fresh session at target repo root |
```

- [ ] **Step 4: Verify + commit**

Run: `grep -c "session-debrief\|onboard-repo\|kit/" docs/workflow.md` → ≥ 4

```bash
git add docs/workflow.md
git commit -m "docs(workflow): debrief step, kit/prompt locations, lifecycle checks 14-16"
```

---

### Task 5: plugin conversion

**Goal:** cc-config installs as a personal plugin — hooks auto-register, skills bundle, install.sh retires.

**Files:**
- Create: `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `hooks/hooks.json`
- Modify: `README.md`, `install.sh` (deprecation header), `hooks/picking-model-tier-context.sh` (namespaced skill name if needed — see Step 5)

**Acceptance Criteria:**
- [ ] `claude plugin validate .` passes (or the current equivalent — Step 0 confirms the command)
- [ ] Plugin installs from local marketplace; skills appear as `cc-config:*`; SessionStart + PreCompact hooks fire without manual settings.json wiring
- [ ] All repo references to unnamespaced skill names updated or confirmed harmless

**Verify:** fresh session after install → `picking-model-tier` pre-flight fires with NO `SessionStart` entry for it in `~/.claude/settings.json`

**Steps:**

- [ ] **Step 0: Confirm current plugin schema (do not skip)**

The JSON below is from January 2026 knowledge and may have drifted. Dispatch the claude-code-guide agent: "current schema for .claude-plugin/plugin.json, marketplace.json, and plugin hooks/hooks.json; current validate/install commands". Reconcile the files below against its answer before writing them.

- [ ] **Step 1: plugin.json**

```json
{
  "name": "cc-config",
  "description": "Personal cross-project workflow: model-tier pre-flight, handoffs, session debrief, token-aware routing",
  "version": "1.0.0",
  "author": { "name": "jem0ntr053" }
}
```

- [ ] **Step 2: marketplace.json**

```json
{
  "name": "cc-config-marketplace",
  "owner": { "name": "jem0ntr053" },
  "plugins": [
    {
      "name": "cc-config",
      "source": "./",
      "description": "Personal cross-project workflow: model-tier pre-flight, handoffs, session debrief, token-aware routing"
    }
  ]
}
```

- [ ] **Step 3: hooks/hooks.json**

```json
{
  "hooks": {
    "SessionStart": [
      { "hooks": [ { "type": "command", "command": "${CLAUDE_PLUGIN_ROOT}/hooks/picking-model-tier-context.sh" } ] }
    ],
    "PreCompact": [
      { "hooks": [ { "type": "command", "command": "${CLAUDE_PLUGIN_ROOT}/hooks/precompact-context.sh" } ] }
    ]
  }
}
```

- [ ] **Step 4: Install and validate**

```bash
claude plugin validate .            # command per Step 0
claude plugin marketplace add ~/cc-config
claude plugin install cc-config@cc-config-marketplace
```

Expected: validate passes; install succeeds; new session lists `cc-config:picking-model-tier`, `cc-config:writing-handoffs`, `cc-config:session-debrief`.

- [ ] **Step 5: Reference sweep**

```bash
grep -rn "picking-model-tier\|writing-handoffs\|session-debrief" --include='*.md' --include='*.sh' . | grep -v '.git/' | grep -v 'cc-config:'
```

For each hit, decide: hook context text that tells Claude which skill to invoke → update to the namespaced name (`cc-config:picking-model-tier`); prose mentions in docs → leave (names still resolve by suffix, but confirm in a fresh session; if suffix resolution fails, update prose too). `plugin-routing.md` rows stay unnamespaced only if the fresh-session check passes.

- [ ] **Step 6: Retire install.sh + README**

Prepend to `install.sh`:

```bash
echo "DEPRECATED: cc-config is now a plugin. Use:"
echo "  claude plugin marketplace add ~/cc-config && claude plugin install cc-config@cc-config-marketplace"
echo "Symlink install still works during transition. Continuing..."
```

README: replace the Install + "Wire the SessionStart hook" sections with the two plugin commands; note the manual hook wiring is no longer needed; keep a "legacy symlink install" subsection. Users on other machines: remove old symlinks (`rm ~/.claude/skills/picking-model-tier ~/.claude/skills/writing-handoffs ~/.claude/skills/session-debrief ~/.claude/hooks/*-context.sh ~/.claude/plugin-routing.md`) and the manual SessionStart entry from `~/.claude/settings.json` after confirming the plugin fires (avoid double-firing hooks).

- [ ] **Step 7: Behavioral verify + commit**

Fresh session in any repo. Expected: picking-model-tier pre-flight context appears (from plugin hook), skills listed namespaced, no double-fire (exactly one pre-flight injection).

```bash
git add .claude-plugin hooks/hooks.json install.sh README.md
git commit -m "feat: convert cc-config to a plugin — auto hook registration, versioned install"
```

---

## Task order and dependencies

Task 1 → Task 2 (routing row references the skill) → Task 3 (compress after additions) → Task 4 (checks reference final routing). Task 5 last (sweeps everything). One PR per task or one stacked PR — executor's choice; each task is one commit minimum.
