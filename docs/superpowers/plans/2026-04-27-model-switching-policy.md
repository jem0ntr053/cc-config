# Model-switching policy implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the approved model-switching policy from `docs/superpowers/specs/2026-04-27-model-switching-policy-design.md` by rewriting `skills/picking-model-tier/SKILL.md` and lightly extending `skills/writing-handoffs/SKILL.md`.

**Architecture:** The policy is enforced entirely through markdown skills consumed by the Claude Code agent at session start and at the end of each session. `picking-model-tier` becomes the read-side: it consults three intent sources in priority order (handoff doc → memory → user's first prompt) at session start, picks a tier, then refuses every subsequent mid-session tier switch. `writing-handoffs` becomes the write-side: at session end it emits both a `## Recommended Model` section in the handoff doc (source #1) **and** a `session-handoff-…` memory entry (source #2) so a fresh session has the same data in two independently-resilient stores. `plugin-routing.md` and `docs/workflow.md` get one-row description touch-ups so the rest of the docs stay consistent.

**Tech Stack:** Markdown skill files only. No code, no compiled tests. "Tests" are concrete fixture-based scenarios that a human runs from a fresh `claude` session and verifies the agent's first decision against an expected tier.

**Pre-requisites already complete:**
- Spec merged on main: `docs/superpowers/specs/2026-04-27-model-switching-policy-design.md`
- Existing skills present: `skills/picking-model-tier/SKILL.md`, `skills/writing-handoffs/SKILL.md`
- Issue tracker: cc-config#1 (this work), cc-config#3 (hard prereq for sources #1+#2 to populate reliably; not blocking this plan)

**Working branch:** `plan/model-switching-policy` (already created off main).

---

### Task 1: Add session-handoff memory write to writing-handoffs skill

**Goal:** Make every handoff also produce a memory entry, so intent source #2 is populated alongside source #1.

**Files:**
- Modify: `skills/writing-handoffs/SKILL.md` (append a new section after the existing "Required Output Format" section, around line 50)

**Acceptance Criteria:**
- [ ] `skills/writing-handoffs/SKILL.md` documents that, after writing the handoff doc, the agent also calls `memory_store` with a `session-handoff-…` entry
- [ ] The memory entry schema is unambiguously specified (name, description format, type)
- [ ] The skill makes clear this memory write is mandatory, not optional
- [ ] Committed locally; not yet pushed (push happens in Task 6)

**Steps:**

- [ ] **Step 1: Read current skill file** to confirm the insertion point

```bash
cat /Users/montrose/cc-config/skills/writing-handoffs/SKILL.md
```
Expected: file ends after the "When NOT to Use" section at the bottom.

- [ ] **Step 2: Edit `skills/writing-handoffs/SKILL.md`** — insert the following section immediately after the "Required Output Format" section (which ends with the `Resume:` example block) and before the "Examples" section:

```markdown
## Required Memory Write

After writing the handoff doc, also store a memory entry so the next session can recover the recommended model even if the handoff file is deleted or the next session is cross-project.

Call `mcp__plugin_automem_memory__store_memory` with exactly this shape:

- **name:** `session-handoff-YYYY-MM-DD-HHMM` (use the timestamp at handoff write time, in UTC)
- **description:** `Session handoff: next session should use <tier>. Intent: <intent-category>.`
  - `<tier>` is one of `opus`, `sonnet`, `haiku` — must match the `Model:` line in the doc
  - `<intent-category>` is one of `design`, `execute-plan`, `mechanical`, `unclear`
- **type:** `project`
- **content:** the full Recommended Model block (the three lines `Model: …`, `Reason: …`, `Resume: …`) verbatim, so the source-of-truth tier is captured in the body

This memory write is **mandatory**, not optional. The picking-model-tier skill consults it as intent source #2.
```

- [ ] **Step 3: Inspect diff** to confirm only the new section was added

```bash
git -C /Users/montrose/cc-config diff skills/writing-handoffs/SKILL.md
```
Expected: a single hunk that adds ~16 lines under a new `## Required Memory Write` heading.

- [ ] **Step 4: Commit**

```bash
git -C /Users/montrose/cc-config add skills/writing-handoffs/SKILL.md
git -C /Users/montrose/cc-config commit -m "feat(writing-handoffs): emit session-handoff memory entry alongside doc

Populates intent source #2 from the model-switching policy spec
(docs/superpowers/specs/2026-04-27-model-switching-policy-design.md).

Refs cc-config#1.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Rewrite picking-model-tier skill — top to bottom replacement

**Goal:** Replace the current "rubric only, no intent sources, no mid-session refusal" skill with one that implements the full policy from the spec.

**Files:**
- Modify (full replacement of body, frontmatter unchanged): `skills/picking-model-tier/SKILL.md`

**Acceptance Criteria:**
- [ ] Frontmatter (`name`, `description`) unchanged — the skill still triggers on the same situations
- [ ] Body explicitly distinguishes "session start (cache cold)" vs "mid-session (cache warm)" decisions
- [ ] Body lists all three intent sources in the spec's priority order, each with a concrete instruction for how to read it
- [ ] Body specifies the four-row intent → tier mapping verbatim from the spec
- [ ] Body lists the three recovery options for "started on wrong tier" verbatim from the spec
- [ ] Body explicitly forbids the mid-session `/model` switch and explains the cache-cost reason
- [ ] Body includes the effort-dial section (per-turn, parallel, no cache cost)
- [ ] No "TBD" / "TODO" / vague hand-waves
- [ ] Committed locally; not yet pushed

**Steps:**

- [ ] **Step 1: Confirm current skill content** is what you expect to replace

```bash
cat /Users/montrose/cc-config/skills/picking-model-tier/SKILL.md
```
Expected: the existing 58-line skill ending with the "Red Flags" section.

- [ ] **Step 2: Replace the file body** (everything below the `---` frontmatter delimiter at line 4) with the following exact content. Keep lines 1-4 (the YAML frontmatter and its closing `---`) unchanged:

```markdown

# Picking Model Tier

## Overview

Opus eats tokens. Mechanical edits on opus are waste. Architecture calls on haiku are worse. Worse still: a mid-session `/model` switch invalidates the warm prompt cache and pays a ~$0.26 round-trip on a 50K-token context, exceeding the savings on any task under ~10K mechanical tokens. This skill picks the right tier **once**, at session start, then refuses every subsequent in-session switch.

The full design is in `docs/superpowers/specs/2026-04-27-model-switching-policy-design.md`.

## When This Skill Fires

- **Session start (cache cold):** the agent has just been launched, or the user has just run `/clear`. Pick the tier here.
- **Mid-session (cache warm):** any turn after the first substantive one. Refuse to switch tier; surface the three recovery options instead.

The two cases use different logic. Do not conflate them.

## Session Start - Pick the Tier

### Step 1: Determine session intent from the priority sources

Consult the three sources below **in strict priority order**. The first source that yields a value wins. Do not consult later sources once a value is found.

**Source #1 - Most recent handoff doc with a `## Recommended Model` section**

Look in the current project's `docs/superpowers/handoffs/` directory (and `plans/` and `docs/superpowers/plans/` as fallbacks - any of those may contain a handoff). Sort by mtime. For the newest file, search for the literal heading `## Recommended Model`. If present, parse the `Model:` line; that tier wins.

```bash
# Concrete recipe the agent runs:
ls -t docs/superpowers/handoffs/*.md plans/*.md docs/superpowers/plans/*.md 2>/dev/null \
  | head -20 \
  | xargs -I{} sh -c 'grep -l "## Recommended Model" "{}" 2>/dev/null | head -1' \
  | head -1
```

If the recipe returns a file, read its `Model:` line and use that tier.

**Source #2 - Most recent `session-handoff-…` memory entry**

Call `mcp__plugin_automem_memory__recall_memory` with a query like `"session-handoff recommended model"` and `limit: 5`. Find the most recent entry whose `name` field starts with `session-handoff-`. Parse the description's `<tier>` placeholder; that tier wins.

If no such memory entry exists, fall through to source #3.

**Source #3 - User's first prompt of the session**

Classify the user's first substantive message against the intent table below. Pick the matching tier.

### Step 2: Map intent to tier

| Session intent | Tier |
|---|---|
| Design / brainstorm / plan / unclear scope | `opus` |
| Execute a written plan with no judgment calls | `sonnet` |
| Mechanical edit against a well-specified target | `haiku` |
| No clear intent | `opus` (quality default) |

### Step 3: Confirm or switch before doing real work

- If the current model already matches the picked tier: proceed silently. Do not announce the check.
- If the current model is the **wrong** tier: tell the user in one short line, e.g.

  > Session intent looks like execute-plan (handoff doc names sonnet). Suggest `/model sonnet` before we start - saves opus tokens with no capability loss.

  Wait for the user to confirm the switch (or override) before starting substantive work. Classification, brief clarifying questions, and reading existing files are fine pre-switch; edits, multi-file investigations, and non-trivial commands are gated.

## Mid-Session - Refuse to Switch

If at any point during the session the agent would otherwise tell the user to run `/model <tier>`, **stop**. The cache cost of the switch exceeds the savings on essentially every remaining task.

Instead, surface the three recovery options exactly as listed in the spec:

> Started on the wrong tier. Three recovery options:
> 1. **Accept it** - finish what we started; the over- or under-spend is bounded by remaining session length.
> 2. **`/clear` and restart** - same `claude` process, fresh context (cache resets to cold), pick the right tier this time.
> 3. **Save handoff via `writing-handoffs` and start a new `claude` session** - preserves work-in-progress across the tier switch.
>
> Mid-session `/model` switching is never the right call - it invalidates the warm cache and pays the round-trip cost for whatever savings the cheaper tier might have given.

Wait for the user to pick one. Do not pre-choose for them. If the user explicitly overrides ("just switch anyway"), honor it but do not initiate it.

## Effort Dial - Per-Turn, No Cache Cost

Effort (`xhigh` / `high` / `medium` / `low`) is independent of tier. It controls thinking-token budget without invalidating the prompt cache, so it can be re-set per turn:

| Activity | Effort |
|---|---|
| Design / debug / unknown failure mode | `xhigh` or `high` |
| Standard execution from a written plan | `medium` |
| Mechanical edit | `low` |

Adjust effort freely. Adjust tier never (within a session).

## When NOT to Use

- Continuation of in-session work past the first substantive turn - the session-start check has already happened; do not re-run it.
- One-off questions, lookups, or chitchat - not a "session" in the cache-amortization sense.
- User explicitly says "stay on `<model>`" or "don't check tier" - honor the override.

## Red Flags

- About to suggest a mid-session `/model` switch → wrong; surface the three recovery options instead.
- About to dive into substantive edits without consulting the priority-source list → stop and consult.
- Found a handoff doc but ignored it in favor of classifying the user's prompt → wrong; source #1 wins.
- Adjusting effort confused with adjusting tier → effort is per-turn-fine, tier is per-session-locked.
```

- [ ] **Step 3: Inspect diff** to confirm the body was replaced cleanly and the frontmatter is intact

```bash
git -C /Users/montrose/cc-config diff skills/picking-model-tier/SKILL.md | head -30
```
Expected: the diff shows the old body removed and the new body added; the first ~4 lines (`---` / `name:` / `description:` / `---`) are unchanged.

- [ ] **Step 4: Verify the frontmatter is still parseable**

```bash
head -4 /Users/montrose/cc-config/skills/picking-model-tier/SKILL.md
```
Expected output (exactly):
```
---
name: picking-model-tier
description: Use when user asks to start work on an issue/bug/feature, implement something, fix something, or begin any new coding task - checks whether the current model tier (opus/sonnet/haiku) fits the task and tells the user to switch if not.
---
```

- [ ] **Step 5: Commit**

```bash
git -C /Users/montrose/cc-config add skills/picking-model-tier/SKILL.md
git -C /Users/montrose/cc-config commit -m "feat(picking-model-tier): rewrite for session-start-only tier policy

Implements the approved model-switching policy from
docs/superpowers/specs/2026-04-27-model-switching-policy-design.md:
- consult intent sources in priority order at session start
- four-row intent->tier rule
- refuse mid-session /model switch; surface three recovery options
- effort dial as per-turn parallel control

Refs cc-config#1.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Update plugin-routing.md row for picking-model-tier

**Goal:** The always-on row description in `plugin-routing.md` currently reads "starting any new task" - which is true but no longer captures the new behavior. Update it to mention intent-source consultation.

**Files:**
- Modify: `plugin-routing.md` (one row in the "ALWAYS-ON" trigger table, around line 39)

**Acceptance Criteria:**
- [ ] The `picking-model-tier` row in the trigger table mentions intent sources or session-start-only behavior
- [ ] Row width still fits the existing column layout (no broken alignment)
- [ ] No other rows touched
- [ ] Committed locally; not yet pushed

**Steps:**

- [ ] **Step 1: Read the current trigger-table row**

```bash
grep -n "^picking-model-tier" /Users/montrose/cc-config/plugin-routing.md
```
Expected output (line number may vary):
```
39:picking-model-tier       | starting any new task            | 🟢 | trivial chat
```

- [ ] **Step 2: Replace the row** using a single Edit:

  - Old string: `picking-model-tier       | starting any new task            | 🟢 | trivial chat`
  - New string: `picking-model-tier       | session start (intent-sourced)   | 🟢 | mid-session, chitchat`

  Note: the column layout uses fixed-width spacing. The new "session start (intent-sourced)" string is 31 chars vs the original "starting any new task" (21 chars), so reduce surrounding spaces accordingly to keep the `🟢` column aligned. Final byte-exact line:

  ```
  picking-model-tier       | session start (intent-sourced)   | 🟢 | mid-session, chitchat
  ```

- [ ] **Step 3: Verify alignment** by inspecting the surrounding rows

```bash
grep -n "ALWAYS-ON" /Users/montrose/cc-config/plugin-routing.md
sed -n '35,42p' /Users/montrose/cc-config/plugin-routing.md
```
Expected: the `🟢` column lines up vertically across all ALWAYS-ON rows.

- [ ] **Step 4: Commit**

```bash
git -C /Users/montrose/cc-config add plugin-routing.md
git -C /Users/montrose/cc-config commit -m "docs(plugin-routing): update picking-model-tier row for intent-sourced policy

Refs cc-config#1.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Update docs/workflow.md if it mentions picking-model-tier behavior

**Goal:** `docs/workflow.md` is the human-readable companion to `plugin-routing.md`. If it describes how the tier check works, update that description to match the new policy. If it does not mention picking-model-tier at all, this task is a no-op.

**Files:**
- Possibly modify: `docs/workflow.md`

**Acceptance Criteria:**
- [ ] If `docs/workflow.md` references picking-model-tier behavior, the reference is updated to match the new spec
- [ ] If no such reference exists, the file is unchanged and this task closes as a no-op
- [ ] Committed locally if changes were made; not yet pushed

**Steps:**

- [ ] **Step 1: Search for any mention of `picking-model-tier`, `model tier`, `model switch`, or `/model`**

```bash
grep -n -E "picking-model-tier|model tier|model switch|/model" /Users/montrose/cc-config/docs/workflow.md
```

- [ ] **Step 2a (if no matches): close task as no-op**

  Add a tracking note to the commit log when later tasks commit; no changes here.

- [ ] **Step 2b (if matches found): edit the relevant lines** to bring the prose into alignment with the spec. Concretely, any sentence like "before starting a task, switch to the right model" should be reworded to "at session start, the picking-model-tier skill consults the handoff doc / memory / your first prompt and tells you which tier to be on; mid-session it refuses to switch and surfaces three recovery options instead". Keep the prose terse - this is a one-page playbook.

- [ ] **Step 3 (only if 2b ran): inspect the diff** and ensure no unrelated lines moved

```bash
git -C /Users/montrose/cc-config diff docs/workflow.md
```

- [ ] **Step 4 (only if 2b ran): commit**

```bash
git -C /Users/montrose/cc-config add docs/workflow.md
git -C /Users/montrose/cc-config commit -m "docs(workflow): update tier-check prose for intent-sourced policy

Refs cc-config#1.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Manual verification suite - eight scenarios from a fresh `claude` session

**Goal:** Confirm the rewritten skills produce the right behavior across all the spec's success-criteria cases. These are the closest thing to tests a markdown-skill change has.

**Files:**
- Create: `/tmp/cc-config-test-fixtures/` (scratch area for fixture handoff docs - not committed)

**Acceptance Criteria:**
- [ ] All eight scenarios below produce the expected behavior
- [ ] Failures are documented inline (which skill section is wrong) and fixed before moving to the next task
- [ ] No commit in this task - this is verification only

**Setup once at the start:**

```bash
mkdir -p /tmp/cc-config-test-fixtures/proj-a/docs/superpowers/handoffs
mkdir -p /tmp/cc-config-test-fixtures/proj-b
```

**Scenario 1: source #3 only - design intent → opus**

- [ ] **Step 1.1:** From `/tmp/cc-config-test-fixtures/proj-b` (no handoffs, no relevant memory), launch a fresh `claude` session and prompt: `Help me design a feature flag system from scratch.`
- [ ] **Step 1.2:** Expected: skill announces source #3 used, classifies as design, recommends `opus` (or proceeds silently if already on opus). Document the actual response.

**Scenario 2: source #3 only - execute-plan intent → sonnet**

- [ ] **Step 2.1:** Same dir as scenario 1. Fresh session. Prompt: `Execute the plan at docs/superpowers/plans/some-plan.md - it's already approved.`
- [ ] **Step 2.2:** Expected: classifies as execute-plan, recommends `sonnet`.

**Scenario 3: source #3 only - mechanical intent → haiku**

- [ ] **Step 3.1:** Same dir. Fresh session. Prompt: `Rename every occurrence of foo_bar to fooBar in src/.`
- [ ] **Step 3.2:** Expected: classifies as mechanical, recommends `haiku`.

**Scenario 4: source #3 only - unclear intent → opus default**

- [ ] **Step 4.1:** Same dir. Fresh session. Prompt: `Hey, I'm working on this thing, can you help?`
- [ ] **Step 4.2:** Expected: classifies as unclear, recommends `opus` (quality default).

**Scenario 5: source #1 wins - handoff doc with `## Recommended Model: sonnet`**

- [ ] **Step 5.1:** Create fixture handoff doc:

  ```bash
  cat > /tmp/cc-config-test-fixtures/proj-a/docs/superpowers/handoffs/2026-04-27-handoff.md <<'EOF'
  # Handoff

  Some notes about the in-progress feature.

  ## Recommended Model
  - Model: sonnet
  - Reason: Executing the plan at docs/superpowers/plans/foo.md; mechanical edits only.
  - Resume: `/model sonnet`
  EOF
  ```

- [ ] **Step 5.2:** From `/tmp/cc-config-test-fixtures/proj-a`, launch a fresh `claude` session and prompt: `pick up where we left off`.
- [ ] **Step 5.3:** Expected: skill consults source #1, finds the handoff, recommends `sonnet`. Critically: even if the prompt itself sounds vague (which would default to opus under source #3), source #1 wins.

**Scenario 6: source #2 wins when handoff doc absent but memory entry present**

- [ ] **Step 6.1:** Manually store a memory entry matching the schema from Task 1 (use `mcp__plugin_automem_memory__store_memory` with `name: session-handoff-2026-04-27-1500`, `description: Session handoff: next session should use haiku. Intent: mechanical.`, `type: project`).
- [ ] **Step 6.2:** From a directory with no handoffs file but the memory entry stored against it, launch a fresh `claude` session and prompt the agent generically.
- [ ] **Step 6.3:** Expected: source #1 misses (no handoff doc), source #2 hits (memory found), recommends `haiku`.

**Scenario 7: mid-session refusal**

- [ ] **Step 7.1:** From any session that has been running for more than one substantive turn, ask: `Should we switch to sonnet to save tokens for the next bit?`
- [ ] **Step 7.2:** Expected: skill refuses to recommend a `/model` switch, instead surfaces the three recovery options (accept / `/clear` / handoff + new session) verbatim.

**Scenario 8: writing-handoffs writes both source #1 and source #2**

- [ ] **Step 8.1:** Trigger writing-handoffs at the end of any session.
- [ ] **Step 8.2:** Expected:
  - A handoff `.md` file gets written with the `## Recommended Model` section, AND
  - A `mcp__plugin_automem_memory__store_memory` call is made with `name` starting `session-handoff-`, `type: project`, and `description` matching the documented format from Task 1.
  - Both writes happen; the skill does not skip the memory write.

**If any scenario fails:**

- [ ] Identify which skill section produced the wrong behavior
- [ ] Edit the offending skill (`picking-model-tier` or `writing-handoffs`)
- [ ] Re-run the failing scenario
- [ ] Commit the fix as `fix(picking-model-tier): <one-line>` or `fix(writing-handoffs): <one-line>` referencing cc-config#1

---

### Task 6: Push branch + open PR

**Goal:** Get the implementation in front of the user for review and merge.

**Files:** None (git/CLI operations only)

**Acceptance Criteria:**
- [ ] Branch `plan/model-switching-policy` pushed to origin
- [ ] PR opened against main with the standard summary + test plan body
- [ ] secret-scan CI green on the PR
- [ ] PR is mergeable (linear history compatible, status check satisfied)

**Steps:**

- [ ] **Step 1: Push the branch**

```bash
git -C /Users/montrose/cc-config push -u origin plan/model-switching-policy
```

- [ ] **Step 2: Open PR**

```bash
gh pr create --repo jem0ntr053/cc-config \
  --title "feat: implement model-switching policy (cc-config#1)" \
  --body "$(cat <<'EOF'
## Summary
- Implements the approved model-switching policy from `docs/superpowers/specs/2026-04-27-model-switching-policy-design.md`.
- Rewrites `skills/picking-model-tier/SKILL.md` to enforce session-start-only tier picks via three priority intent sources.
- Adds a required memory write to `skills/writing-handoffs/SKILL.md` so intent source #2 stays populated.
- Touch-ups to `plugin-routing.md` and (if applicable) `docs/workflow.md` to keep the docs consistent.

## Closes / Refs
- Refs cc-config#1
- Hard prereq cc-config#3 (forcing functions) - not blocking; sources #1/#2 only populate reliably once #3 lands. Until then, source #3 (user's first prompt) carries the policy.

## Test plan
- [ ] All eight verification scenarios from the plan's Task 5 run from a fresh `claude` session and produce expected behavior
- [x] secret-scan CI green
- [ ] No mid-session `/model` recommendation reproducible after the rewrite

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Wait for CI**

```bash
gh pr checks $(gh pr list --repo jem0ntr053/cc-config --head plan/model-switching-policy --json number --jq '.[0].number') --repo jem0ntr053/cc-config --watch
```
Expected: `gitleaks` check completes with `success`.

- [ ] **Step 4: Confirm mergeable**

```bash
gh pr view $(gh pr list --repo jem0ntr053/cc-config --head plan/model-switching-policy --json number --jq '.[0].number') \
  --repo jem0ntr053/cc-config \
  --json mergeable,mergeStateStatus
```
Expected: `mergeable: MERGEABLE`, `mergeStateStatus: CLEAN`.

- [ ] **Step 5: Hand control back to the user** with the PR URL and a one-line summary of what changed. Do not auto-merge.

---

## Done when

- All six tasks above complete with their acceptance criteria checked
- PR is open, CI green, mergeable
- User has reviewed and either approved (then merge via squash) or requested changes (loop back to the relevant task)
