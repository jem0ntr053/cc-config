# cc-config

Cross-project Claude Code workflow config. Hooks, generic skills, the canonical token-aware plugin-routing reference, and design docs for the workflow improvement initiative.

This repo contains config that should govern *every* Claude Code session, regardless of which project you're in. Per-project config (e.g. `dotfiles-*` skills) stays in the project's own repo.

## Install

```bash
cd ~/cc-config
bash install.sh
```

Idempotent. Re-run after `git pull` to refresh symlinks.

## Dev setup (contributors only)

After cloning, wire the local pre-commit hook so secrets get caught before they ever reach a commit:

```bash
git config core.hooksPath .githooks
brew install gitleaks   # or see https://github.com/gitleaks/gitleaks
```

The same scan runs in CI (`.github/workflows/secret-scan.yml`) and is a required status check on `main` - the local hook just gives faster feedback.

## Layout

| Path | What lives here |
|------|-----------------|
| `plugin-routing.md` | Canonical token-aware tool/skill routing reference. Auto-loaded by the global CLAUDE.md via `@~/.claude/plugin-routing.md`. |
| `skills/picking-model-tier/` | Skill - checks task vs current model tier at start-of-work. |
| `skills/writing-handoffs/` | Skill - appends `## Recommended Model` section to handoff docs. |
| `hooks/precompact-context.sh` | PreCompact hook - injects MEMORY.md + CLAUDE.md into compaction context. |
| `docs/workflow.md` | Human-readable one-page playbook (companion to `plugin-routing.md` which is for Claude). |
| `docs/superpowers/specs/` | Design docs for workflow improvements (model-switching policy, forcing functions, etc.). |
| `docs/superpowers/plans/` | Implementation plans derived from specs. |

## What this repo does NOT contain

- `~/.claude/settings.json` - has machine-specific paths; per-machine state
- `~/.claude/projects/*/memory/` - per-project memory snapshots
- Project-specific skills (those live in the project's repo)

## Origin

Spun out from `jem0ntr053/dotfiles` on 2026-04-27. See `MIGRATED.md`.
