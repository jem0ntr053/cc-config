---
name: picking-model-tier
description: FIRST SKILL TO FIRE EVERY SESSION. Pre-flight tier check that runs BEFORE brainstorming, systematic-debugging, writing-plans, or any other skill. Reads intent sources (handoff doc / memory / first prompt), picks tier (opus/sonnet/haiku), tells the user to /model switch if mismatched. Fires on EVERY first substantive prompt - design, fix, implement, plan, brainstorm, mechanical, or anything else. Mid-session: refuses to switch tiers and surfaces three recovery options instead.
---

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
# Concrete recipe the agent runs.
# Uses `find` (not globs) so missing directories don't abort the pipeline
# under zsh's nomatch behavior — which is what the Claude Code Bash tool runs.
find docs/superpowers/handoffs plans docs/superpowers/plans \
  -maxdepth 1 -name '*.md' 2>/dev/null \
  | xargs ls -t 2>/dev/null \
  | xargs grep -l "## Recommended Model" 2>/dev/null \
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
