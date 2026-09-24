# Handoff — build the `code-swarm` plugin (universal harness)

Date: 2026-09-23
From: Fable session that wrote the spec and plan
To: Sonnet session that executes the plan

## Paste this as the first message

```
Execute the plan at /Users/montrose/cc-config/docs/superpowers/plans/2026-09-01-code-swarm-plugin.md, Tasks 1 through 4 only, in order.
Read /Users/montrose/cc-config/docs/superpowers/handoffs/2026-09-23-code-swarm-build.md first.
Use superpowers-extended-cc:executing-plans. Per task: mattpocock-skills:tdd where there is testable logic, then mattpocock-skills:code-review on the diff before each commit.
Work on branch feat/universal-harness-spec in /Users/montrose/cc-config. Never commit to main. Do not push unless I say so.
Stop after Task 4's dry-run on daily-operating-system and report the verify outputs.
```

## What this is

One harness for every personal repo: a Claude Code plugin `code-swarm` in the
`cc-config` marketplace. A repo opts in with `.swarm.json`. `/swarm` turns
`agent-ready` GitHub issues into verified PRs (human merges);
`/swarm --build "prompt"` turns a short prompt into a spec plus issues. Jev
gates (TypeSafe) sit between agents in shadow mode.

The design is settled. Do not redesign. Read in this order:

1. `docs/superpowers/plans/2026-09-01-code-swarm-plugin.md` — the plan, 9 tasks, checkbox steps, verify commands.
2. `docs/superpowers/specs/2026-09-23-universal-harness-design.md` — why; Additions 1–3 back Tasks 7–9.
3. `docs/superpowers/specs/` in AutoCrate: `2026-08-25-issue-swarm-design.md` — the prototype's agent contracts.

## State

| Thing | Where | Status |
|---|---|---|
| Working prototype swarm | `/Users/montrose/Developer/GitRepositories/AutoCrate/.claude/{skills/swarm,agents}` | runs; hardcoded to AutoCrate |
| Plugin `code-swarm` | `/Users/montrose/cc-config/code-swarm/` | does not exist yet |
| Pilot repo | `/Users/montrose/Developer/GitRepositories/daily-operating-system` | on branch `develop`; no `.swarm.json` yet; `main` exists on origin |
| cc-config branch | `feat/universal-harness-spec` | 4 commits of docs, unmerged, not pushed |
| TypeSafe key | `~/.config/typesafe/.env` (mode 600) | provisioned + smoke-tested; Task 9 only |
| Plan tasks | all 9 pending; Task 9 Step 0 done | |

Task order: 1 → 2, 3 → 4 (stop here) → 7, 8 → 9 → 5 → 6. Task 6 (AutoCrate
migration) is last and needs the user to confirm the deletion list.

## Things the plan cannot tell you

- **Plugin refresh.** After editing anything under `code-swarm/`, the running plugin does not see it until `claude plugin marketplace update cc-config-marketplace && claude plugin update code-swarm` and a Claude Code restart. Task 4's dry-run needs this. The first install is `claude plugin install code-swarm@cc-config-marketplace`.
- **Version bump rule** (cc-config README): bump `version` in the plugin's `.claude-plugin/plugin.json` on every merged change to `skills/` or `agents/`.
- **Worktree test trap** (AutoCrate lesson): a shared venv's editable install pins imports to the main checkout. Agents must set the repo's equivalent of `PYTHONPATH=src` before tests in a worktree, or they silently test the wrong code. The generic agents say "prepare env per repo norms"; keep that warning in `issue-implementer.md` and `pr-verifier.md` as a generic sentence.
- **Bash hook blocks heredocs** containing `.unlink()` or `os.remove` (global `guard-destructive.sh`). Use the Write tool for such files. Keep this rule in the implementer agent.
- **Labels must exist** in the pilot repo before a real run: `feature design-review agent-ready pr-open needs-human swarm-found security tests` via `gh label create`. Dry-run does not need them.
- **`claude -p` and plugin skills** (Task 5): unverified whether headless mode can invoke `/swarm`. Check before building the nightly; fallback is calling the Workflow entry directly.
- **`op://` references** reject parentheses in item titles; use the item ID (recorded in Task 9 Step 0).
- **Global hooks fire in every session here**: caveman + ponytail modes, rtk command rewriting, a Stop-hook notification. Ponytail is the house style for the code you write: stdlib first, no speculative abstraction, one runnable check per non-trivial piece.
- **Human gate is non-negotiable.** Nothing in the plugin labels `agent-ready` or merges. If a step seems to need it, stop and ask.
- **Nothing is armed.** Every `.swarm.json` you create has `armed: false`.

## Verify before claiming any task done

Each task in the plan has a **Verify** line. Run it, paste the output. Task 4's
final check is `git status --porcelain | grep -v '^??' | wc -l` → `0` in the
pilot repo after `/swarm --dry-run`.

## Recommended Model
- Model: sonnet
- Reason: Executing the approved plan Tasks 1–4 (scaffold plugin, config loader, agent decoupling, pilot dry-run) with verify commands already written.
- Resume: `/model sonnet`
