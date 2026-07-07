# Dotfiles workflow

One-page playbook. Read top-to-bottom when starting; jump to a section when stuck.

Built for this brain: explicit steps, no hedging, decision tables, named commands.

---

## When overwhelmed - minimum viable steps

1. Open this file.
2. `gh issue list --state open` - what's actually pending.
3. Pick **one** issue. Branch: `git checkout -b <topic>`.
4. Tell Claude in one sentence what you're doing.

Don't try to plan more than one issue at once.

---

## Starting any task

| Step | Command | Why |
|------|---------|-----|
| 1. Pick the work | `gh issue list` | Single source of truth |
| 2. Branch | `git checkout -b <topic>` | Main is protected |
| 3. Pick model | Run `/model <tier>` per skill suggestion | `picking-model-tier` reads handoff/memory/first prompt at session start; locks tier for the session |
| 4. State the goal | One sentence to Claude | "Fix #44 font weight on dark bg" |

---

## Working

- **One issue at a time.** Resist scope creep.
- Spotted another bug? → `gh issue create`, then back to current task.
- Claude shows diffs before applying - by default per memory rules.
- Use `dotfiles-<domain>` skills for domain gotchas: sketchybar, aerospace, nvim, mcp, security, shell.
- Use `gh issue list --search <topic>` mid-task to confirm what's open.

---

## Finishing

| Step | Command |
|------|---------|
| 1. Verify | Run + visually check (screenshot for UI) |
| 2. Commit | `git commit -m "..."` (no `Co-Authored-By` trailer) |
| 3. PR | `gh pr create` (no "Generated with Claude Code" line) |
| 4. Merge | `gh pr merge <#> --squash --delete-branch` |
| 5. Sync | `git checkout main && git pull` |
| 6. Debrief | say "wrap up" — `session-debrief` audits confidence, routes to handoff (a BLOCKER here can reopen an issue — merged ≠ immune) |

---

## When stuck

| Symptom | Action |
|---------|--------|
| "I don't know where to start" | `gh issue list` → pick one |
| "Claude is slow / drifting" | `/clear`, restart with one-sentence goal |
| "Context feels bloated" | `/compact` - precompact hook injects MEMORY.md + CLAUDE.md |
| "Forgot what I was doing" | `git status` + `git log --oneline -5` |
| "What was decided last time?" | Read `~/.claude/projects/-Users-montrose-dotfiles/memory/MEMORY.md` |
| "What skill applies here?" | Check the `available skills` list in Claude's session-start reminder |

---

## Anti-patterns - don't

- Push directly to `main` (blocked anyway)
- Edit on `main` without branching first
- Batch 4+ fixes in one session - one issue, verify, then next
- Mirror GitHub issues in markdown punchlists - they drift stale
- Add new long-form content to `CLAUDE.md` - it auto-loads every session; put it in a skill or `docs/`

---

## Where things live

| What | Where |
|------|-------|
| Open work / bugs / polish | GitHub issues |
| Repo file inventory | `docs/file-map.md` |
| Token-aware tool routing (Claude reads) | `~/.claude/plugin-routing.md` |
| Domain guidance (Claude loads on demand) | `~/.claude/skills/dotfiles-<X>/SKILL.md` |
| Recent decisions / context | Automem (MCP) - Claude recalls automatically |
| Per-project session-recall hints | `~/.claude/projects/-Users-montrose-dotfiles/memory/MEMORY.md` |
| Plans / specs (write-once, read-once) | `docs/superpowers/{plans,specs}/` |
| Guardrails kit (vendored, verbatim) | `~/cc-config/kit/` (upstream + hashes: `kit/MANIFEST.sha`) |
| Repo onboarding prompt | `~/cc-config/prompts/onboard-repo.md` — paste into a fresh session at target repo root |

---

## Token-saving habits

- **Use a skill** instead of explaining context - `/dotfiles-sketchybar` etc.
- Let `gh issue list` answer "what's open" - don't ask Claude to recall.
- Don't paste large files into chat - Claude reads files itself.
- Keep `CLAUDE.md` slim. New architecture details → into a skill.
- `/caveman` = ~75% fewer output tokens; `/caveman:compress <file>` for memory files.

---

## Lifecycle phases - which skill to invoke at each step

Mirrors the phase strips in `plugin-routing.md`. Use this as the human-readable companion. Each step names the *specific* skill or agent — no ambiguity.

### RESEARCH (Q&A, no code change)
1. `recall_memory` — pull prior decisions / context
2. `context7 query-docs` (libraries) **/** `Explore` agent (>3 greps) **/** `claude-code-guide` agent (CC/SDK/API how-to)
3. Answer in chat (no code edits)

### CONFIG (settings, hooks, dotfiles)
1. `picking-model-tier` — session-start tier check
2. `update-config` skill (settings.json / hooks / permissions) **OR** direct edit (other dotfiles)
3. `verification-before-completion` — confirm setting actually took effect
4. `store_memory` — only if the change reflects a non-derivable preference / decision
5. Commit with `caveman-commit`

### DEBUG (bug, failing test, wrong output)
1. `systematic-debugging`
2. Reproduce reliably
3. Identify root cause (not just symptom)
4. Fix
5. **`security-review` if security-sensitive** *(see trigger below)*
6. `verification-before-completion`
7. Commit with `caveman-commit`

### CODE (feature / non-trivial change)
1. `brainstorming` — design / scope unclear
2. `writing-plans` — multi-step or spec-driven
3. `executing-plans` (TDD inside the loop)
4. `verification-before-completion`
5. **`security-review` if security-sensitive** *(see trigger below)*
6. `requesting-code-review` — output uses `caveman-review` for terse review summaries
7. `finishing-a-dev-branch` — merge / integrate
8. Commit messages along the way: `caveman-commit`

### Security review trigger (heuristic)

Run `security-review` when the change touches **any** of:
- auth / authn / authz code
- secrets, tokens, credentials, API keys
- crypto, signing, hashing, randomness
- network boundaries (HTTP handlers, RPC, deserializers, webhooks)
- input validation at trust boundaries
- file / path handling driven by user input

Skip for docs-only, test-only, UI styling, pure config. When uncertain, run it (🟡 medium cost).

### Caveman variants in the lifecycle

- `caveman` — always-on, all output (toggle with `stop caveman`)
- `caveman-review` — substitute when reviewing a PR / diff (used inside `requesting-code-review` step)
- `caveman-commit` — substitute when authoring a commit message (used at the commit step of every phase)

---

## Verifying the lifecycle works

The phase strips are behavioral guidance — they only "work" if Claude actually walks them. Run these checks in fresh sessions (`/clear` first) to verify. Any row that fails = file an issue.

| # | Phase | Test prompt | Pass criteria |
|---|---|---|---|
| 1 | RESEARCH | "where is `picking-model-tier` defined?" | Uses `Explore` agent or `recall_memory`; no file edits |
| 2 | RESEARCH | "how do I write a Claude Code hook?" | Uses `claude-code-guide` agent or `context7` |
| 3 | CONFIG | "add a new permission to my settings.json" | Invokes `update-config` skill (not direct Edit) |
| 4 | CONFIG | "tweak my aerospace config" | Invokes `dotfiles-aerospace` |
| 5 | DEBUG | "test X is failing intermittently" | Invokes `systematic-debugging` before guessing a fix |
| 6 | CODE | "add feature Y to plugin Z" | Starts with `brainstorming`, then `writing-plans` |
| 7 | CODE | "rename function `foo` to `bar` across the repo" | Skips brainstorm (mechanical), goes direct |
| 8 | Security ON | propose change to a file containing `auth`, `token`, or `crypto` | Claude flags `security-review` before declaring done |
| 9 | Security OFF | propose change to a `.md` doc only | Claude skips `security-review` |
| 10 | caveman-commit | ask for a commit message | Output is terse caveman style (no fluff, fragments OK) |
| 11 | caveman-review | ask Claude to review a diff | Review uses fragments, drops articles, no pleasantries |
| 12 | Tier check | start a session with a handoff doc that has `## Recommended Model: sonnet` | Claude tells you to `/model sonnet` before substantive work |
| 13 | Mid-session | ask to switch model mid-session | Claude refuses, surfaces 3 recovery options |
| 14 | Debrief | say "wrap up" at the end of a work session | `session-debrief` fires: least-confident list + biggest-miss + handoff routing |
| 15 | Kit coexistence | start a session in a repo whose CLAUDE.md has the `guardrails-kit:` marker | kit `TRIGGER:` lines fire AND superpowers skills still invoke; neither suppresses or overrides the other |
| 16 | Onboarding prompt | paste `~/cc-config/prompts/onboard-repo.md` in a scratch repo | Phase 0 classifier runs; `VERIFICATION 0` block pasted before any discovery |

**How to log a failure.** `gh issue create` with title `lifecycle-check #N failed: <phase> <skill>` and paste the prompt + Claude's actual first action. Don't fix it inline — capture the data first.

**Recommended cadence.** Run the full checklist after every change to `plugin-routing.md`, `docs/workflow.md`, or any skill referenced in the strips. Run a spot-check (rows 1, 3, 5, 6, 8) once a week if you've been editing skills.

---

## Model tier quick rule

| Task | Model |
|------|-------|
| Brainstorm / design / unclear scope | Opus 4.7 |
| Plan writing / spec authoring | Opus 4.7 |
| Mechanical edit, follow a plan | Sonnet 4.6 |
| Trivial chat / quick lookup | Haiku 4.5 |

`picking-model-tier` fires at session start, consults handoff doc → memory → your first prompt (in that order) and tells you which tier to use. Mid-session it refuses to switch and surfaces three recovery options (accept / `/clear` / handoff + new session).

---

## See also

- [`plugin-routing.md`](../plugin-routing.md) - technical routing reference (for Claude)
- [Spec: model-switching policy](superpowers/specs/2026-04-27-model-switching-policy-design.md)
- [META issue](https://github.com/jem0ntr053/cc-config/issues) - current workflow improvement work
