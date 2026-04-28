---
name: picking-model-tier
description: Use when user asks to start work on an issue/bug/feature, implement something, fix something, or begin any new coding task - checks whether the current model tier (opus/sonnet/haiku) fits the task and tells the user to switch if not.
---

# Picking Model Tier

## Overview

Opus eats tokens. Running mechanical edits on opus is waste. Running architecture calls on haiku is worse. This skill fires at start-of-work to confirm the current model tier matches the task.

## The Rule

Before starting work, classify the task per the rubric. If the current model tier doesn't match, tell the user to switch with `/model <tier>` before proceeding. Do not start substantive work until the user confirms or overrides. Classification and brief clarifying questions (e.g. "which three files?") are fine pre-switch; actual edits, commands, and multi-step investigation are gated.

## Selection Rubric

| Task type | Model |
|---|---|
| Architecture, brainstorming, cross-file design, root-cause debugging of unknown failures | `opus` |
| Implementing a written plan, test generation from a spec, refactors with clear scope, code review | `sonnet` |
| Mechanical edits, formatting, renames, single-file tweaks, boilerplate, log parsing | `haiku` |

## Default Bias (Opus eats tokens)

- Task has a written plan → `sonnet`
- Task is "decide what to do" → `opus`
- Task is mechanical → `haiku`

## What to Say to the User

If current tier matches the task: proceed silently, no need to mention the check.

If mismatch, say one short line. Format:

> Task looks [category] ([one-phrase reason]). Suggest `/model <tier>` before we start - [token/capability reason].

Examples:

> Task looks mechanical (rename across 2 files). Suggest `/model haiku` before we start - saves tokens.

> Task looks like architecture (no plan yet, cross-file redesign). Suggest `/model opus` before we start - this tier fits design calls.

> Task looks like plan execution (plans/2026-04-22-x.md already written). Suggest `/model sonnet` before we start - saves opus tokens with no capability loss.

## When NOT to Use

- User already on the matching tier → proceed silently.
- Continuation of existing in-session work → don't re-check mid-task.
- User explicitly says "stay on <model>" or "don't switch" → honor override.
- One-off questions / quick lookups → not "starting work."

## Red Flags

- User says "let's work on #N", "fix this bug", "implement X", "start on Y" → this skill applies; run the check.
- About to dive into edits without classifying task → stop and classify first.
- Tier mismatch + proceeding anyway → wrong.
