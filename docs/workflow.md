# Dotfiles workflow

One-page playbook. Read top-to-bottom when starting; jump to a section when stuck.

Built for this brain: explicit steps, no hedging, decision tables, named commands.

---

## When overwhelmed — minimum viable steps

1. Open this file.
2. `gh issue list --state open` — what's actually pending.
3. Pick **one** issue. Branch: `git checkout -b <topic>`.
4. Tell Claude in one sentence what you're doing.

Don't try to plan more than one issue at once.

---

## Starting any task

| Step | Command | Why |
|------|---------|-----|
| 1. Pick the work | `gh issue list` | Single source of truth |
| 2. Branch | `git checkout -b <topic>` | Main is protected |
| 3. Pick model | `/model opus` (design/plan) or `/model sonnet` (mechanical) | `picking-model-tier` skill also nudges |
| 4. State the goal | One sentence to Claude | "Fix #44 font weight on dark bg" |

---

## Working

- **One issue at a time.** Resist scope creep.
- Spotted another bug? → `gh issue create`, then back to current task.
- Claude shows diffs before applying — by default per memory rules.
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

---

## When stuck

| Symptom | Action |
|---------|--------|
| "I don't know where to start" | `gh issue list` → pick one |
| "Claude is slow / drifting" | `/clear`, restart with one-sentence goal |
| "Context feels bloated" | `/compact` — precompact hook injects MEMORY.md + CLAUDE.md |
| "Forgot what I was doing" | `git status` + `git log --oneline -5` |
| "What was decided last time?" | Read `~/.claude/projects/-Users-montrose-dotfiles/memory/MEMORY.md` |
| "What skill applies here?" | Check the `available skills` list in Claude's session-start reminder |

---

## Anti-patterns — don't

- Push directly to `main` (blocked anyway)
- Edit on `main` without branching first
- Batch 4+ fixes in one session — one issue, verify, then next
- Mirror GitHub issues in markdown punchlists — they drift stale
- Add new long-form content to `CLAUDE.md` — it auto-loads every session; put it in a skill or `docs/`

---

## Where things live

| What | Where |
|------|-------|
| Open work / bugs / polish | GitHub issues |
| Repo file inventory | `docs/file-map.md` |
| Token-aware tool routing (Claude reads) | `~/.claude/plugin-routing.md` |
| Domain guidance (Claude loads on demand) | `~/.claude/skills/dotfiles-<X>/SKILL.md` |
| Recent decisions / context | Automem (MCP) — Claude recalls automatically |
| Per-project session-recall hints | `~/.claude/projects/-Users-montrose-dotfiles/memory/MEMORY.md` |
| Plans / specs (write-once, read-once) | `docs/superpowers/{plans,specs}/` |

---

## Token-saving habits

- **Use a skill** instead of explaining context — `/dotfiles-sketchybar` etc.
- Let `gh issue list` answer "what's open" — don't ask Claude to recall.
- Don't paste large files into chat — Claude reads files itself.
- Keep `CLAUDE.md` slim. New architecture details → into a skill.
- `/caveman` = ~75% fewer output tokens; `/caveman:compress <file>` for memory files.

---

## Model tier quick rule

| Task | Model |
|------|-------|
| Brainstorm / design / unclear scope | Opus 4.7 |
| Plan writing / spec authoring | Opus 4.7 |
| Mechanical edit, follow a plan | Sonnet 4.6 |
| Trivial chat / quick lookup | Haiku 4.5 |

`picking-model-tier` skill auto-fires at task start to remind.

---

## See also

- [`plugin-routing.md`](../plugin-routing.md) — technical routing reference (for Claude)
- [Spec: model-switching policy](superpowers/specs/2026-04-27-model-switching-policy-design.md) — once written
- [META issue](https://github.com/jem0ntr053/cc-config/issues) — current workflow improvement work
