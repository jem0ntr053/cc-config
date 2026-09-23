# Universal Harness — Design

Date: 2026-09-23
Status: approved (brainstorm 2026-09-23)
Extends: `docs/superpowers/plans/2026-09-01-code-swarm-plugin.md` (Tasks 1–6 unchanged)
Source: Anthropic, "Harness design for long-running application development"
(Rajasekaran, 2026-03-24, https://www.anthropic.com/engineering/harness-design-long-running-apps)

## Goal

One harness, installed once as the `code-swarm` plugin in the `cc-config`
marketplace, usable in any personal repo that opts in with `.swarm.json`.
Two entry points:

| Entry | Input | Output | Human gate |
|---|---|---|---|
| `/swarm` | `agent-ready` issues | verified PRs | labels `agent-ready`; merges |
| `/swarm --build "<prompt>"` | 1–4 sentence prompt | `docs/specs/<slug>.md` + one issue per feature | labels `agent-ready` |

The existing plan delivers the first row. This spec adds the second row and
one evaluator upgrade, both taken from the article.

## What the article adds over the current swarm

| Article component | Current swarm equivalent | Gap |
|---|---|---|
| Planner: short prompt → full product spec, ambitious scope, no low-level detail | `feature-architect` designs one issue | No prompt → spec → issues path |
| Generator: builds one feature at a time | `issue-implementer` (sonnet, worktree, brief = contract) | none |
| Evaluator: separate context, skeptical, drives running app via Playwright, hard per-criterion thresholds | `pr-verifier` (separate context, runs tests + SCA + over-engineering lens) | Never exercises the running product |
| Sprint contract negotiated before code | triager brief (files / steps / tests / acceptance) | none — brief already is the contract |
| Context resets | Workflow agents are fresh per call | none |
| "Strip non-load-bearing parts when models improve" | spec Sizing section: read journal after 5 runs | keep |

Deliberately not built (rung 1): sprint-contract negotiation loop,
continuous single-generator build mode, context-reset orchestration.
Article dropped sprints on Opus 4.6; the issue pipeline already decomposes.

## Addition 1 — `product-planner` agent and `--build`

### Agent: `product-planner` — model: fable, effort: high
Tools: Read, Grep, Glob, Bash (read-only), Write (spec file only).

Input: prompt text, repo root, today's date.

Procedure:
1. Read `CLAUDE.md`, `README.md`, `ROADMAP.md` if present. Brownfield: the
   spec must fit the existing stack and invariants. Greenfield (none
   present): pick the smallest stack that fits the prompt and say why.
2. Expand the prompt into a product spec at
   `docs/specs/<YYYY-MM-DD>-<slug>.md`:
   - Overview (what, for whom, why)
   - Features: numbered, each with user stories ("As a user, I want … so
     that …") and a data model sketch
   - High-level technical design: stack, module boundaries, storage
   - Explicitly NOT: file paths, function names, line-level steps. Errors
     in granular upfront detail cascade into implementation (article).
3. Be ambitious on scope; every feature must still be a single-PR unit.
   Order features by dependency.
4. Where an AI feature would genuinely serve the product, include it as a
   feature; never bolt one on.

5. Commit the spec on branch `spec/<slug>`, push, open PR `spec: <slug>`.

Output JSON: `{ spec_path, pr_url, features: [{n, title, depends_on: [n]}], findings }`.

### Filing
The `/swarm --build` path runs `product-planner`, then the existing
`issue-groomer` once per feature, sequentially in dependency order so each
issue body can cite the real numbers of the issues it depends on, with the
spec path in the prompt. Groomer files each issue
**unlabeled** in `issue-ready` shape (Files / Change / Test / Acceptance),
body linking `docs/specs/<slug>.md#feature-<n>` and any `depends_on`
issues. Design-question features get `feature` label. Nothing gets
`agent-ready`; the human reads, edits, and labels.

### Gate
`--build` requires `.swarm.json` present; `armed` may be false (no code is
written). Refuses when `docs/specs/<slug>.md` already exists (rerun means a
new slug or manual delete). Spec file is committed on a branch
`spec/<slug>` with a PR; issues reference the PR. Human merges the spec PR.

### swarm.js
New top-level mode alongside `audit` / `docs`:
```
if (build) → planner → for each feature: groomer → return { spec_path, pr_url, issues, unfiled }
```
`args.build = "<prompt>"`. Schemas: `PLAN_SCHEMA`, groomer reuses
`FILER_SCHEMA` shape (`created[]`). Full code in plan Task 7 Step 3.

## Addition 2 — evaluator lens in `pr-verifier`

### Config
`.swarm.json` optional block:
```json
"app": { "start_cmd": "npm run dev", "url": "http://localhost:5173", "ready_wait_s": 10 }
```
Absent → verifier behaves exactly as today. Zero cost for CLI repos.

### Behavior when `app` is set
Trigger: diff touches any file the brief marks as UI/API, or any file under
the repo's declared frontend/backend dirs (conventions doc), or the issue's
Acceptance section names a URL or user action.

1. In the worktree: run `start_cmd` in background, wait `ready_wait_s`,
   confirm `url` answers. Record the PID via the port (`lsof -ti :PORT`);
   never kill by image name.
2. Invoke skill `example-skills:webapp-testing` (Playwright). Walk every
   `brief.tests[].asserts` and every issue Acceptance line **as a user
   would**: click, type, submit, read the DOM, hit API endpoints, inspect
   state. Screenshot each criterion.
3. Skeptic rules (article tuning, verbatim in the agent prompt):
   - An issue you identify is a finding. Do not decide it "isn't a big
     deal" and approve. Report it; the human decides.
   - Test edge cases and the second path, not only the happy path.
   - Display-only or stubbed behavior that the criterion says is
     interactive = FAIL.
   - Each finding names the criterion, the observed behavior, and the
     file:line when known (see article's example table).
4. Hard threshold: any criterion FAIL → `changes_requested`. No weighted
   score; the criteria are binary because the brief made them so.
5. Kill the app by PID. Worktree left clean.

Output unchanged: `{ verdict, reasons[], tests, findings[] }`; each
Playwright failure is one `reasons[]` entry prefixed `app:`.

## Failure handling (additions)

| Failure | Action |
|---|---|
| Planner returns null / spec unwritable | abort build, print prompt back, no issues filed |
| Groomer fails on feature n | file the rest; summary lists n as `unfiled` with the spec anchor so the human can file by hand |
| App fails to start in verifier | `changes_requested` with reason `app: failed to start (<stderr tail>)`; never approve blind |
| Playwright skill unavailable | `changes_requested` with reason `app: evaluator lens unavailable`; human runs it |

## Testing the additions

1. `/swarm --build "todo app with tags"` on daily-operating-system
   (unarmed): spec file appears on branch `spec/…`, N unlabeled issues
   exist, each in issue-ready shape linking the spec; `git status` on main
   clean; rerun with same slug refused.
2. Add `app` block to a web repo's `.swarm.json`; run `/swarm --issue N` on
   a trivially broken UI issue (button wired to nothing). Verifier must
   `changes_requested` with an `app:` reason and a screenshot path.
3. Same repo, `app` block removed → verifier approves on tests alone
   (proves the lens is opt-in).

## Sizing / removal rule

Article: every harness component encodes an assumption about what the
model cannot do alone; re-test on each model release. After 5 `--build`
runs, read from labels and journal: how many planner features needed human
rewrite before `agent-ready`; how many `app:` reasons were real. If the
planner's issues need no edits, drop the human label step to opt-in. If
`app:` reasons are noise, narrow the trigger.
