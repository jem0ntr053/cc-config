# Plugin Routing Reference

Canonical token-aware routing. Pick the right tool for the phase. Cheap calls first, heavy workflows only when warranted.

**Audience:** Claude (auto-loaded). Human-readable companion: `docs/workflow.md`.

Legend: 🟢 cheap/free · 🟡 medium · 🔴 heavy

## Phase Strips (lifecycle order)

```
RESEARCH:  recall-memory → context7 / Explore-agent → answer (no code)
CONFIG:    [picking-model-tier] → update-config OR direct-edit → verify → store-memory(if novel)
DEBUG:     systematic-debugging → reproduce → root-cause → fix → verification-before-completion
CODE:      brainstorming → writing-plans → executing-plans (TDD inside) → verification → requesting-code-review → finishing-branch
```

## Always-On Defaults (auto, no invocation)

- caveman mode - terse output (until "stop caveman")
- automem recall_memory - session start
- gh issue list - session start (open work tracked in GitHub issues, not markdown)
- LSP (swift / pyright / lua) - auto on matching file edits
- picking-model-tier - starting any new task
- auto-memory writes - learn user fact / feedback / project state / external reference

## Skip Rules

- One-line edit / dotfile tweak → skip brainstorm + plan; go direct
- Pure Q&A → research track only
- Bug w/ obvious one-char fix → skip systematic-debugging
- Settings.json change → always update-config skill (not direct edit)

## Trigger Table

```
Skill | When to use | Cost | When to skip

ALWAYS-ON
caveman mode             | terse every reply                | 🟢 | "stop caveman"
automem recall_memory    | session start                    | 🟢 | offline
LSP (swift/pyright/lua)  | matching file edits              | 🟢 | non-matching lang
picking-model-tier       | session start (intent-sourced)   | 🟢 | mid-session, chitchat
auto-memory write        | learn user fact / feedback       | 🟢 | derivable from code

INTAKE / RESEARCH
context7 query-docs      | lib/framework/SDK/API question   | 🟡 | general concept
Explore agent            | "where is X?", >3 grep queries   | 🟡 | known path
claude-code-guide agent  | Claude Code / SDK / API how-to   | 🟡 | unrelated topic
WebSearch                | non-lib current info             | 🟡 | use context7 instead

PLANNING (code track)
brainstorming            | new feature, design unclear      | 🔴 | one-line / config / bug
writing-plans            | multi-step task, spec exists     | 🔴 | <30min work
Plan agent               | impl strategy, no code yet       | 🔴 | already clear

EXECUTION
executing-plans          | written plan ready               | 🔴 | no plan
TDD                      | feature/bugfix w/ testable logic | 🟡 | UI polish, config
subagent-driven-dev      | independent parallel tasks       | 🔴 | sequential / trivial
dispatching-parallel-agents | 2+ no-shared-state tasks      | 🔴 | shared state
using-git-worktrees      | risky/long branch isolation      | 🟡 | small edit

DEBUG
systematic-debugging     | bug / test fail / wrong output   | 🟡 | obvious typo

VERIFICATION & REVIEW
verification-before-completion | claiming "done"           | 🟢 | no claim made
simplify                 | post-write refactor pass         | 🟡 | trivial diff
requesting-code-review   | feature complete, pre-merge      | 🔴 | WIP
receiving-code-review    | got review feedback              | 🟢 | no review yet
caveman-review           | reviewing PR/diff terse          | 🟢 | not reviewing
security-review          | security-sensitive change        | 🟡 | docs only
finishing-a-dev-branch   | impl done, integrate?            | 🟡 | mid-work

CONFIG / DOTFILES
update-config            | settings.json, hooks, perms      | 🟢 | non-config edit
keybindings-help         | ~/.claude/keybindings.json       | 🟢 | unrelated
fewer-permission-prompts | reduce permission noise          | 🟢 | rare prompts
dotfiles-aerospace       | aerospace config                 | 🟢 | not aerospace
dotfiles-sketchybar      | sketchybar config                | 🟢 | not sketchybar

MEMORY (automem)
recall_memory            | resume context, prior decisions  | 🟢 | unrelated topic
store_memory             | new decision/pref/incident       | 🟢 | derivable info
update_memory            | correct stale memory             | 🟢 | new fact
delete_memory            | wrong/outdated entry             | 🟢 | still valid

COMMITS & PRs
caveman-commit           | writing commit msg               | 🟢 | not committing
review                   | reviewing GitHub PR              | 🔴 | own diff

SCHEDULING
loop                     | recurring poll / interval        | 🟡 | one-shot
schedule                 | future-dated cleanup / cron      | 🟡 | now-task
ScheduleWakeup           | self-paced /loop ticks           | 🟢 | non-loop

OUTPUT COMPRESSION
caveman:compress         | shrink CLAUDE.md / memory files  | 🟢 | small file
```

## Anti-Patterns (Never)

- Brainstorm a one-line config tweak
- TDD a throwaway script
- context7 for general programming concepts
- Self-launch ultrareview (user-only)
- Casually delete `.superpowers/` session dirs
- Mirror GitHub issues in markdown punchlists or memory snapshots - issues are canonical
