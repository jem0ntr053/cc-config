# Plugin Routing Reference

Canonical token-aware routing. Cheap calls first; heavy workflows only when warranted. **Audience:** Claude (auto-loaded). Human companion: `docs/workflow.md`. Legend: 🟢 cheap · 🟡 medium · 🔴 heavy.

## Phase Strips (lifecycle order)

`[brackets]` = conditional. `*` = security-review footnote. Per-step detail: Trigger Table below.

```
RESEARCH: recall_memory → context7 / Explore-agent / claude-code-guide-agent → answer (no code)
CONFIG:   picking-model-tier → update-config OR direct-edit → verification-before-completion → [store_memory] → [caveman-commit]
DEBUG:    systematic-debugging → reproduce → root-cause → fix → [security-review *] → verification-before-completion → [caveman-commit]
CODE:     brainstorming → writing-plans → executing-plans (TDD) → verification-before-completion → [security-review *] → requesting-code-review (caveman-review) → finishing-a-dev-branch → [caveman-commit]
```

**\* security-review trigger** (heuristic, not always-run). Invoke when the change touches: auth/authn/authz; secrets/tokens/credentials/API keys; crypto/signing/hashing/randomness; network boundaries (HTTP handlers, RPC, deserializers, webhooks); input validation at any trust boundary; file/path handling driven by user input. Skip for docs-only, test-only, UI styling, pure config not touching the above. When in doubt, run it (🟡).

## Skip Rules

- One-line edit / dotfile tweak → skip brainstorm + plan; go direct
- Pure Q&A → research track only
- Bug w/ obvious one-char fix → skip systematic-debugging
- Settings.json change → always update-config skill (not direct edit)

## Trigger Table

```
Skill | When to use | Cost | When to skip

ALWAYS-ON (auto, no invocation)
caveman mode             | terse every reply                | 🟢 | "stop caveman"
automem recall_memory    | session start                    | 🟢 | offline
gh issue list            | session start (issues canonical) | 🟢 | offline
LSP (swift/pyright/lua)  | matching file edits              | 🟢 | non-matching lang
picking-model-tier       | session start (intent-sourced)   | 🟢 | mid-session, chitchat
auto-memory write        | user fact/feedback/state/ext-ref | 🟢 | derivable from code

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
session-debrief          | session ending, "wrap up"        | 🟢 | mid-session, trivial Q&A

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

## Guardrails-Kit Repos (deconflict)

Repo CLAUDE.md has `guardrails-kit:` marker → kit routing (`TRIGGER:` lines, `docs/guardrails/` Reads) runs INSIDE whatever skill is active. Kit = per-repo floor; this file = global router. Precedence on conflict: user's explicit instruction > repo CLAUDE.md/kit rule > this file's defaults. Never suppress a kit `TRIGGER:` line to follow a phase strip — do both.

## Effort Dial (reasoning-effort per turn — NOT a /model tier switch; picking-model-tier locks tier per session)

design/debug/unknown-failure → high · plan execution → medium · mechanical edit/rename/format → low

## Plans Carry Verification

Every plan task ships: verify command + expected output. The session's picked tier (per picking-model-tier, usually opus) writes plans and grades results; the cheapest tier that passes the verify blocks executes. No verify block = plan not done.

## Anti-Patterns (Never)

- Brainstorm a one-line config tweak
- TDD a throwaway script
- context7 for general programming concepts
- Self-launch ultrareview (user-only)
- Casually delete `.superpowers/` session dirs
- Mirror GitHub issues in markdown punchlists or memory snapshots - issues are canonical
