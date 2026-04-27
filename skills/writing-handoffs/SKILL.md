---
name: writing-handoffs
description: Use when writing handoff documents — plans/ files, worktree handoff notes, phase transitions, "resume here next session" summaries, or any doc meant for another Claude session to pick up.
---

# Writing Handoffs

## Overview

Handoff documents get read by a fresh Claude session. That session has to pick a model (opus/sonnet/haiku) before it starts. Wrong pick = wasted tokens or wasted capability. This skill makes the handoff author tell the reader which model to use.

## The Rule

**Every handoff document MUST end with a `## Recommended Model` section.**

Handoff documents include:
- Files in `plans/`, `docs/superpowers/plans/`, `docs/superpowers/handoffs/`
- "Resume here" / "pick up next session" notes
- Phase-transition or session-summary docs
- Any file whose purpose is to bootstrap another session

If the doc is NOT a handoff (a spec, a bug report, a README), skip.

## Selection Rubric (deterministic)

| Task type | Model |
|---|---|
| Architecture, brainstorming, cross-file design, root-cause debugging of unknown failures | `opus` |
| Implementing a written plan, test generation from a spec, refactors with clear scope, code review | `sonnet` |
| Mechanical edits, formatting, renames, single-file tweaks, boilerplate, log parsing | `haiku` |

## Default Bias (Opus eats tokens)

- Next step has a written plan → `sonnet`
- Next step is "decide what to do" → `opus`
- Next step is mechanical → `haiku`

## Required Output Format

Append exactly this block at the end of the handoff (after every other section). The `~~~` below are markdown fences showing the block — paste only the heading and three bullets, not the tildes:

~~~
## Recommended Model
- Model: sonnet
- Reason: <one sentence, ≤25 words, no em-dash continuation — what the next session is doing and why that tier fits>
- Resume: `/model sonnet`
~~~

Fill `Model` and `Resume` with the actual choice. `Reason` must be ONE sentence (one period, ≤25 words, no em-dash splicing), concrete about the next step (not "the work continues").

## Examples

**Good:**
~~~
## Recommended Model
- Model: sonnet
- Reason: Executing approved plan at plans/2026-04-22-claude-md-split.md; mechanical file creation and edits only.
- Resume: `/model sonnet`
~~~

**Bad (vague reason):**
~~~
- Reason: Continuing the work.
~~~

**Bad (wrong tier):**
~~~
- Model: opus
- Reason: Running a rename across three files.
~~~
Rename is mechanical → `haiku`. Opus here burns tokens.

## Red Flags

- About to write `plan.md`, `handoff.md`, `session.md`, or file in `plans/` / `handoffs/` → this skill applies; append the section.
- Reason is vague or more than one sentence → rewrite.
- Model tier doesn't match rubric → recheck.

## When NOT to Use

- Spec docs, bug reports, READMEs, ADRs.
- Quick in-conversation summaries not saved to a file.
