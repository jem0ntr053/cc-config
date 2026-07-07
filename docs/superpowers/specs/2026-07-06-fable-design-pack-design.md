# Fable Design Pack — Design

Date: 2026-07-06
Author: Claude (Fable 5) + montrose
Status: draft, pending user review
Context: Fable 5 subscription access ends 2026-07-07. Today's session produces designs,
prompts, and Opus-executable plans — not a fully built system. Opus builds the rest from
the plans, each task carrying its own verification.

## Goal

Five user deliverables, resolved as follows:

| # | Ask | Resolution |
|---|-----|-----------|
| 1 | Unified prompt for creating skills/instructions in any repo | `prompts/onboard-repo.md` — written today by Fable |
| 2 | Skills/instructions/hooks in this repo | Spec'd today; built later by Opus from plans |
| 3 | Repo usable everywhere | Already true via `install.sh` symlinks; plugin conversion later strengthens it |
| 4 | Plugin or not? | **Yes, later** — see Decision Record below |
| 5 | Cost-optimal resource system | Upgrades to the existing tier/effort/handoff stack — see Cost System |

Non-goal: rebuilding what exists. Global CLAUDE.md is already 3 `@import` lines (~168
loaded lines total). `picking-model-tier`, `writing-handoffs`, plugin-routing, and the
caveman stack stay.

## Key input: the Guardrails Kit (TheColliny/FableClaudeMDForOpus)

A portable kit: ~45-line always-loaded CLAUDE.md core (iron rules + event-phrased
routing table) + 8 on-demand `docs/guardrails/*.md` playbooks + `MIGRATE.md` (verbatim
transport procedure, idempotent, line-accounted). Purpose-built to make Opus/Sonnet run
near-Fable level.

**Decision: kit = project layer, superpowers = global layer.**
- Kit gets installed per-repo by the onboarding prompt, so any session in those repos —
  even one without the user's plugins — gets guardrails.
- The global superpowers/plugin-routing stack stays as-is.
- Deconfliction: one new row in `plugin-routing.md` stating that in kit-equipped repos,
  kit routing (event-triggered doc Reads) runs *inside* whatever superpowers skill is
  active; kit iron rules never override user instructions or CLAUDE.md.
- Kit is vendored verbatim at `kit/` with `kit/MANIFEST.sha` (`git hash-object` of every
  file at vendor time) so drift is detectable. Upstream URL recorded in the manifest.
  Kit's upgrade model requires byte-identity — never edit vendored files.

## Component 1 — `prompts/onboard-repo.md` (the unified prompt)

Self-contained prompt, pasteable into a fresh session in any repo. Merges the
retiring-fellow taxonomy, the guardrails kit install, and this config's discipline
(verification blocks, ground-truth-only authoring, review passes).

**Phase 0 — Size the repo.** Countable classifier, no judgment calls:
- commits ≥ 200 AND (tests exist OR CI config exists) → class **M** (mature)
- commits < 200 AND repo has working code → class **S** (small tool / dotfiles)
- little/no code yet → class **G** (greenfield)
Class sets the skill budget: M = 10–16, S = 4–6, G = 3 plus a growth checklist
(which skills to add when the repo crosses class boundaries).

**Phase 1 — Discover.** Retiring-fellow discovery scaled by class: README/manifest,
build system, test invocation, CI, git history (reverts, dead branches, stalls),
TODO/FIXME hotspots, issue artifacts, project memory. Ends with ≤5 questions to the
user, only for what the repo cannot answer (hardest live problem, unwritten rules,
audience, costliest past failures, definition of "advanced").

**Phase 2 — Install the guardrails kit.** Execute `<KIT>/MIGRATE.md` exactly (it
self-selects fresh-install vs migration vs upgrade mode). `<KIT>` defaults to
`~/cc-config/kit/`. Kit is the floor (generic discipline); skills are the ceiling
(project knowledge).

**Phase 3 — Author skills.** Class-scaled taxonomy from the retiring-fellow prompt
(change-control, debugging-playbook, failure-archaeology, architecture-contract,
domain-reference, config-and-flags, build-and-env, run-and-operate,
diagnostics-and-tooling, validation-and-qa, docs-and-writing, external-positioning;
advanced: hardest-problem campaign, proof toolkit, research frontier, methodology).
Merge thin categories, split deep ones. Authoring rules baked in:
- Audience: zero-context mid-level engineer or Sonnet-class model.
- Ground truth only — verify every command/flag/path against the repo first.
- Trigger-rich `description` frontmatter; imperative runbook voice; when-NOT-to-use
  + sibling pointers; date-stamp volatile facts; "Provenance and maintenance" footer
  with one-line re-verification commands.
- Write only inside `.claude/skills/`; no mutating git commands.
- Parallel subagents where the platform supports them; sequential otherwise.
- State alignment: skills reference the kit's `docs/STATE.md` convention; a
  writing-handoffs handoff doc is a superset of STATE.md — never two competing
  state files.

**Phase 4 — Review.** Three passes then one fixer (from the user's review prompt):
factual (invented/stale commands, paths, claims), process (contradictions with
project rules or kit, ungated behavior changes), usability (trigger quality,
duplication, self-containedness, scannability). Fix blocking + important; introduce
no new unverified claims while fixing.

**Phase 5 — Report + quality gate.** Skill inventory table, one-line purposes,
spot-checks performed, remaining uncertainty, recommended loading order
(architecture-contract → change-control → build-and-env → validation-and-qa →
debugging-playbook), maintenance-soon list. Gate: a zero-context agent must be able
to answer — what is this system; what must not break; how do I set up/run/test;
how do I debug; how do I know a fix is real; how do I avoid historical failures;
how do I safely change behavior; how do I advance it without unverifiable claims.
Reject skills that only restate the README.

**Every phase ends with a verification block**: exact commands + expected output,
so a weaker model self-checks and the user audits the transcript.

## Component 2 — Cost system upgrades

Existing stack already covers tier-picking (picking-model-tier), state transport
(writing-handoffs), output compression (caveman). Additions:

1. **Plans carry verification.** New rule appended to the writing-plans usage in
   `plugin-routing.md` and honored by `prompts/onboard-repo.md`: every plan task gets
   a verify command + expected output. Purpose: cheapest-capable model executes;
   anyone can grade. Generalizes the "Fable plans / Opus executes" pattern into
   "supervisor tier plans and verifies / cheapest tier that passes the verify blocks
   executes."
2. **Effort-dial defaults** (new subsection in `plugin-routing.md`): design/debug =
   high, plan execution = medium, mechanical = low. Effort is per-turn and
   cache-free; tier is per-session and locked (existing policy unchanged).
3. **Session debrief hook** — `hooks/session-debrief.sh`, registered as a Stop hook.
   Injects at session end: (a) "What are you least confident about right now — list
   items, flag any that should block"; (b) "What is the biggest thing the user is
   missing about the situation?"; (c) "If work continues, write a handoff via
   writing-handoffs." Mechanical trigger beats remembered habit.
4. **Deconflict row** in `plugin-routing.md` (see kit decision above).
5. **plugin-routing compression pass** — apply kit formatting principles
   (event-phrased triggers, countable thresholds, prohibition+replacement pairs) to
   shrink the always-loaded file toward ~90 lines with zero semantic loss. Use
   `caveman:compress` as the tool, hand-verify the diff.

## Component 3 — Decision Record: plugin conversion

**Decision: convert cc-config into a personal Claude Code plugin — after the design
pack lands, as an Opus task.**

For: plugin hooks auto-register (kills the manual SessionStart wiring the README
documents as the fragile step); marketplace versioning pins config across machines;
skills/hooks/commands bundle as one unit; `install.sh` retires.
Against (accepted): migration ceremony; skills get namespaced
(`cc-config:picking-model-tier`) so references in docs/hooks need a sweep; plugin
update is a pull-and-bump instead of instant `git pull`.
Shape: this repo doubles as its own marketplace (`.claude-plugin/marketplace.json` +
`plugin.json`); layout otherwise unchanged.

## Build order (what runs when)

Today (Fable): this spec → `prompts/onboard-repo.md` → vendor `kit/` + manifest →
implementation plans for the rest → commit + PR.

Later (Opus, from plans, unsupervised): session-debrief hook + registration docs,
plugin-routing deconflict row + effort defaults + verification rule, plugin-routing
compression, plugin conversion, workflow.md lifecycle-check additions.

## Testing

- **Onboarding prompt dry-run** per class: run against a fixture (G: empty repo;
  S: this repo; M: user's dotfiles repo), check phase verification blocks all emit.
- **Coexistence check**: session in a kit-equipped repo with superpowers active;
  pass = kit TRIGGER lines fire and superpowers skills still invoke, no contradictory
  instructions surfaced.
- **Stop-hook check**: end a session; debrief questions appear.
- New rows appended to the lifecycle-check table in `docs/workflow.md`.

## Error handling

- Kit vendor drift: `kit/MANIFEST.sha` mismatch → re-vendor from upstream, never
  hand-patch.
- MIGRATE.md failures mid-run: the kit's own log/resume machinery handles it; the
  onboarding prompt defers to it rather than wrapping it.
- Onboarding a repo that already has skills: Phase 1 inventories them; Phase 3
  updates rather than duplicates (one home per fact).
