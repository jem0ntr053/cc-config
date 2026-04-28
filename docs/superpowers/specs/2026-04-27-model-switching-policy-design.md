# Model-switching policy - design

**Date:** 2026-04-27
**Topic:** Define when to switch Claude model tier (Opus / Sonnet / Haiku) within and across Claude Code sessions, accounting for prompt-cache invalidation cost.
**Brainstorm origin:** dotfiles#75 (now mirrored to cc-config#1). Design was approved during that brainstorm; spec write was paused while the cc-config repo split landed (dotfiles#79 → cc-config bootstrap), and resumes here against the saved checkpoint comment on cc-config#1.

---

## Goal

Establish a single decision rule for **which model to use** at session start and **whether to switch** mid-session, such that:

1. The default behavior optimizes for **quality**, then cost, then cognitive overhead - in that priority order
2. Mid-session model switches do not silently waste prompt-cache spend (a round-trip on a warm 50K-token context costs roughly $0.26 - more than the savings on any task under ~10K mechanical tokens, which covers nearly all routine work in this codebase)
3. The rule is mechanical enough that the user does not need to make a tier decision every time work begins

---

## Decisions (locked during brainstorm)

| # | Question | Decision |
|---|----------|----------|
| 1 | Priority order across the three competing concerns | **Quality > Cost > Cognitive overhead** |
| 2 | Strategy shape | **Option 3 - Hybrid:** session-start tier picked from intent, no mid-session switching |
| 3 | What drives the session-start tier | Session **intent**, derived from a fixed-priority source list (see Architecture) |
| 4 | Mid-session policy when wrong model is detected | Stay on current model, OR `/clear` + restart, OR save handoff + start a new `claude` session. **Never** mid-session `/model` switch. |
| 5 | Effort dial (think tokens) | Parallel control, no cache cost - adjust per turn independently of model tier |

Rationales for each are in the brainstorm transcript saved to dotfiles#75 (mirrored as the first comment on cc-config#1).

---

## Architecture

### The rule

**At session start (cache cold), pick model from session intent:**

| Session intent | Model |
|----------------|-------|
| Design / brainstorm / plan / unclear scope | Opus |
| Execute a written plan with no judgment calls | Sonnet |
| Mechanical edit against a well-specified target | Haiku |
| No clear intent | Opus (quality default) |

**Mid-session (cache warm): stay on the current model.**

The cache-cost calculus: on a typical 50K-token context, a round-trip through the prompt-cache miss path costs roughly $0.26. That exceeds the savings of moving to a cheaper tier on any task under ~10K mechanical tokens, which covers nearly all dotfiles- and cc-config-class work. The break-even is high enough that "always stay" is the right default at the granularity of an individual session.

If you realize mid-session that you started on the wrong tier, the recovery options are:

1. **Accept it** - finish what you started; the over- or under-spend is bounded by the session length
2. **`/clear` and restart** - same `claude` process, fresh context, pick the right tier this time
3. **Save handoff via writing-handoffs and start a new `claude` session** - preserves work-in-progress across the tier switch

**The one move that is never correct: a mid-session `/model` switch.** It invalidates the warm cache and pays the round-trip cost for whatever savings the cheaper tier might have provided - typically a net loss on the remaining work.

### Where session intent comes from

In strict priority order, the first source that yields a value wins:

1. **The most recent handoff document with a `## Recommended Model` section** (produced by the `writing-handoffs` skill at the end of the previous session)
2. **The most recent memory entry tagged with intent + recommended model**
3. **The user's first prompt of the session**

Sources 1 and 2 only work in practice if the previous session reliably produced them. That is the dependency on cc-config#3 (forcing functions) - see Dependencies.

### Effort dial - parallel, no cache cost

Effort (`xhigh` / `high` / `medium` / `low`) is a per-turn knob that controls thinking budget without invalidating cache. It is therefore decoupled from the tier rule above and is set per turn:

| Activity | Effort |
|----------|--------|
| Design / debug / unknown failure mode | xhigh or high |
| Standard execution from a written plan | medium |
| Mechanical edit | low |

Effort can move freely turn-to-turn within a session. Tier cannot.

---

## Dependencies

- **Hard prerequisite:** cc-config#3 - forcing functions, specifically the end-of-session writing-handoffs invocation. Without it, intent source #1 (recent handoff) is empty almost every session, and the rule degrades to "user states intent at session start" (source #3).
- **Soft prerequisite:** the existing `writing-handoffs` skill must continue to write a `## Recommended Model` section into every handoff doc. (Current skill already does this - no change required, but the policy assumes it.)

Until cc-config#3 lands, the rule is still usable - it just leans more heavily on source #3 (user's first prompt) than on the persisted-state sources.

---

## Out of scope (explicitly deferred)

- **Statusline display** of current model and inferred session intent - candidate work item for cc-config#3 (forcing functions), not part of this policy spec
- **Whether to update, delete, or replace the existing `picking-model-tier` skill** - implementation detail for the plan that follows this spec
- **`/fast` mode** - orthogonal latency optimization on Opus 4.6; does not interact with the tier-selection rule and is not governed by this spec
- **Auto-detection of session intent from the user's prompt** (NLP classification, etc.) - explicitly rejected during brainstorm in favor of the three-source priority list above; revisit only if source #3 proves unreliable in practice

---

## Success criteria

- A fresh `claude` session in any project can answer the question "which tier should I be on?" using only: (a) the most recent handoff doc, (b) the most recent intent-tagged memory entry, or (c) the user's first prompt - in that order - without further user prompting
- Sessions that begin with a handoff doc start on the tier specified by `## Recommended Model` without the user re-stating intent
- The `picking-model-tier` skill (or whatever replaces it per the implementation plan) refuses to mid-session-switch tier and instead surfaces the three recovery options (accept / `/clear` / handoff + new session)
- A retroactive review of any session where the wrong tier was used can show that **none** of the recovery actions taken was a mid-session `/model` switch
