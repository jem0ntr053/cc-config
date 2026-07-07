<!-- onboard-repo prompt v1.0 | source: ~/cc-config/prompts/onboard-repo.md | authored by Fable 5, 2026-07-06 -->
<!-- USAGE: paste this entire file as the first message of a fresh session at the target repo's root.
     Works on any Claude model; designed so Opus/Sonnet can execute it unsupervised.
     Prerequisite: the guardrails kit at <KIT> (default ~/cc-config/kit/). -->

You are a distinguished principal engineer onboarding this repository so that future
sessions — cheaper models, zero-context engineers — can debug, extend, validate, and
advance it at your standard. You produce two layers:

- **Floor:** the guardrails kit (generic discipline), installed verbatim from `<KIT>`.
- **Ceiling:** a project skill library under `.claude/skills/` (project knowledge).

`<KIT>` = `~/cc-config/kit/` unless the user names another path. Correctness outranks
token cost, but every phase below ends with a VERIFICATION block — run its commands and
paste their real output before moving on. An unpasted verification counts as failed.

Ground rules for the whole run:
- Write only inside `.claude/skills/`, `docs/guardrails/`, `docs/STATE.md`, and the
  repo's CLAUDE.md (via MIGRATE.md only). Everything else is read-only.
- No mutating git commands (no commit, push, reset, checkout). The user commits.
- Never paraphrase kit files — they are copied, not retyped.
- Verify every command, flag, and path against the repo before writing it into a skill.
  A wrong runbook is worse than none.

---

## Phase 0 — Size the repo (determines everything downstream)

Run and paste:

```bash
git rev-list --count HEAD 2>/dev/null || echo 0          # commit count
ls package.json Makefile pyproject.toml Cargo.toml go.mod build.gradle 2>/dev/null
find . -maxdepth 3 \( -name '*test*' -o -name '*spec*' \) -not -path '*/node_modules/*' -not -path '*/.git/*' | head -5
ls .github/workflows .gitlab-ci.yml .circleci 2>/dev/null # CI presence
```

Classify by count, not judgment:

| Class | Rule | Skill budget |
|---|---|---|
| **M** (mature) | commits ≥ 200 AND (tests found OR CI found) | 10–16 skills |
| **S** (small tool / dotfiles) | commits < 200 AND working code exists | 4–6 skills |
| **G** (greenfield) | little or no working code | 3 skills + growth checklist |

**VERIFICATION 0:** paste the command outputs and one line: `CLASS: <M|S|G> — commits=<n>, tests=<yes|no>, ci=<yes|no>`.

---

## Phase 1 — Discover before you write (no authoring yet)

Investigate like an incoming principal engineer. Scale by class — class M does all
items; class S does items 1–5; class G does items 1–2 and skips history mining.

1. README, manifest, contributor docs, existing CLAUDE.md and `.claude/` contents
   (inventory existing skills — you will update, never duplicate them).
2. Build system: how it actually builds; the test suite and the exact command that
   runs it (run it read-only if side-effect-free; paste the result).
3. CI config: what gates exist, what they enforce.
4. TODO/FIXME hotspots: `grep -rn "TODO\|FIXME" --include='*.{py,ts,js,rs,go,sh,lua,swift}' . | head -30` (adjust extensions to the repo).
5. Issue-shaped artifacts: `gh issue list --state open --limit 20` if GitHub; else docs/notes.
6. Git history (class M): `git log --oneline -100`; reverts (`git log --grep=revert -i --oneline`);
   dead branches (`git branch -a --no-merged | head`); what stalled, what got re-fixed repeatedly.
7. Project memory/notes available to you (MEMORY.md, docs/, handoff files).

Then ask the user **at most 5 questions**, only for what the repo cannot tell you:
(1) hardest live problem right now, (2) unwritten discipline rules, (3) audience for
this library and what they do NOT know, (4) which past failures cost the most time,
(5) what "advancing this project" means. Fold answers into everything below. If the
user is unavailable, log `ASSUMPTION:` lines instead and proceed.

**VERIFICATION 1:** paste a `## Discovery digest` — 10–20 bullet facts, each with its
evidence (`file:line`, command output, or commit hash). Every later skill claim must
trace to a digest fact or a fresh check.

---

## Phase 2 — Install the guardrails kit (floor)

Read `<KIT>/MIGRATE.md` and execute it **exactly, phase by phase**. It self-detects
fresh-install vs migration vs upgrade, backs up first, line-accounts every original
CLAUDE.md line, and stops at its own user checkpoint (M5). Do not wrap, reorder, or
improve it. Its verification steps are in addition to this prompt's.

State convention: the kit's `docs/STATE.md` (SESSION.md S2) is the in-repo state file.
If this user's global stack writes handoff docs (writing-handoffs skill), a handoff doc
is a **superset** of STATE.md — keep STATE.md current either way; never create a second
competing state file.

**VERIFICATION 2:** paste MIGRATE.md's own Phase 8/9 outputs (or fresh-install checks
M8 items 3, 4, 6), plus line 1 of the repo's CLAUDE.md (must contain `guardrails-kit:`).

---

## Phase 3 — Author the skill library (ceiling)

Instantiate this taxonomy ADAPTED to Phase 1 findings — merge thin categories, split
deep ones, add domain categories the taxonomy lacks. Respect the class budget.

CORE (class M: most of these; class S: pick 4–6 by what discovery surfaced;
class G: only ⚑ items):
1. `<project>-architecture-contract` ⚑ — load-bearing design decisions and WHY;
   invariants that must hold; known-weak points stated plainly.
2. `<project>-build-and-env` ⚑ — recreate the environment from scratch; known traps.
3. `<project>-validation-and-qa` ⚑ — what counts as evidence here; how tests are run
   and added; acceptance thresholds.
4. `<project>-change-control` — how changes are classified, gated, reviewed; each
   non-negotiable with its rationale and the incident behind it.
5. `<project>-debugging-playbook` — symptom→triage table; traps that cost real time
   (each with its story); discriminating experiments.
6. `<project>-failure-archaeology` (class M only) — every major investigation, dead
   end, rejected fix, revert: symptom → root cause → evidence → status. Mine git
   history hard; no one re-fights a settled battle.
7. `<domain>-reference` — the domain theory a mid-level person lacks, as it applies
   HERE (not a textbook).
8. `<project>-config-and-flags` — every config axis: options, defaults, prod vs
   experimental, how to add one, re-verification commands.
9. `<project>-run-and-operate` — running/deploying: command anatomy, artifact
   conventions, what lands where.
10. `<project>-diagnostics-and-tooling` — how to MEASURE instead of eyeball; ship
    real scripts in the skill's `scripts/` dir.
ADVANCED (class M, only if discovery justifies):
11. `<project>-<hardest-problem>-campaign` — executable, decision-gated campaign for
    the hardest live problem: numbered phases, exact commands, EXPECTED observations
    at every gate ("if you see X instead → branch to Y"), ranked solution menu,
    wrong paths fenced off, promotion routed through change-control.
12. `<project>-research-frontier` / `<project>-research-methodology` — open problems
    with falsifiable milestones; the evidence bar for accepting a result.

Class G additionally writes `.claude/skills/GROWTH.md`: which skills to add when the
repo crosses class boundaries (first revert → failure-archaeology; first CI → change-control; etc.).

AUTHORING RULES (every skill, no exceptions):
- Format: `.claude/skills/<name>/SKILL.md`; YAML frontmatter with `name` and a
  trigger-rich `description` stating exactly when a model should load it.
- Audience: zero-context mid-level engineer or Sonnet-class model. Imperative runbook
  voice; copy-pasteable commands; every jargon term defined once; tables and
  checklists over prose.
- Each skill names when NOT to use it and which sibling to use instead.
- GROUND TRUTH ONLY: every command/flag/path verified against the repo in this
  session. Unverifiable claims carry `[UNVERIFIED <date>: <why>]`.
- One home per fact — cross-reference siblings instead of duplicating.
- Date-stamp volatile facts. End every skill with `## Provenance and maintenance`:
  one-line re-verification commands for anything that may drift.
- No oversell: unproven things stay labeled open/candidate. Nothing contradicts the
  repo's manifest/rules; no skill routes around change-control.
- Dispatch parallel subagents (one skill per agent) where the platform supports it;
  give each agent the Discovery digest, these authoring rules, and its category spec.
  Otherwise author sequentially in taxonomy order.

**VERIFICATION 3:** paste `ls .claude/skills/*/SKILL.md`, the skill count vs class
budget, and for 3 randomly chosen skills the output of one command each skill claims
(command + real output).

---

## Phase 4 — Review and fix (after ALL skills exist)

Three review passes over the complete set (parallel subagents if available), then one
fixer:
- **FACTUAL:** re-verify flags/paths/commands/citations against the repo; flag anything
  invented or stale; severity = would it send an engineer down a wrong path?
- **PROCESS:** contradictions with the repo's rules, the kit, or between skills;
  overstated claims; behavior changes without gates.
- **USABILITY:** trigger quality of descriptions; duplication (one home per fact);
  self-containedness; scannability; too much theory / too little procedure.

Fixer applies blocking + important findings. Do not introduce new unverified claims
while fixing.

**VERIFICATION 4:** paste the findings table (`severity | skill | finding | fix applied?`)
and the fixer's diffstat (`git diff --stat`).

---

## Phase 5 — Report and quality gate

Deliver in chat:
1. Skill inventory table: name | one-line purpose | class-budget slot | trigger.
2. Verified spot-checks performed (from VERIFICATION 3/4).
3. Remaining uncertainty — explicit list; nothing hidden.
4. Recommended loading order: architecture-contract → change-control → build-and-env
   → validation-and-qa → debugging-playbook → rest.
5. Maintenance-soon list: volatile facts and their re-verification one-liners.

QUALITY GATE — a zero-context agent reading only the kit + these skills must be able
to answer: what is this system; what must not break; how do I set up, run, and test
it; how do I debug real failures; how do I know a fix is real; how do I avoid
repeating historical failures; how do I safely change behavior; how do I advance the
project without unverifiable claims. Any "no" → name the gap and fix it before
reporting done. Reject any skill that only restates the README.

Final line of the run: remind the user to review, commit, and (if they use it) run
their global end-of-session debrief — "what are you least confident about" and "what
is the biggest thing I'm missing" — against this onboarding itself.
