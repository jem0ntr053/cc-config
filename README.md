# cc-config

Cross-project Claude Code workflow config. Hooks, generic skills, the canonical token-aware plugin-routing reference, and design docs for the workflow improvement initiative.

This repo contains config that should govern *every* Claude Code session, regardless of which project you're in. Per-project config (e.g. `dotfiles-*` skills) stays in the project's own repo.

## Install

```bash
claude plugin marketplace add ~/cc-config
claude plugin install cc-config@cc-config-marketplace
```

Plugin hooks register automatically — no settings.json wiring needed.

### Migrating from symlink install

After confirming the plugin fires in a fresh session (check that `picking-model-tier` / `cc-config:picking-model-tier` runs as the first skill), remove the old symlinks and manual `SessionStart` entry to avoid double-firing (hook dedup only matches identical command strings — the plugin's `${CLAUDE_PLUGIN_ROOT}` path and the old `$HOME/.claude/hooks/...` entry are different strings, so both would otherwise fire) and duplicate skills (bare name + `cc-config:`-namespaced):

```bash
rm ~/.claude/skills/picking-model-tier ~/.claude/skills/writing-handoffs ~/.claude/skills/session-debrief
rm ~/.claude/hooks/picking-model-tier-context.sh ~/.claude/hooks/precompact-context.sh ~/.claude/plugin-routing.md
# then remove the picking-model-tier-context.sh SessionStart entry from ~/.claude/settings.json
```

**Warning:** `~/.claude/plugin-routing.md` is `@`-imported by the user's global `CLAUDE.md`. The plugin does NOT replace that import mechanism — `plugin-routing.md` must stay reachable at that path. Do NOT remove the `plugin-routing.md` symlink above unless the global `CLAUDE.md` import is also updated to point at the repo copy instead.

### Legacy symlink install

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
| `skills/picking-model-tier/` | Skill - session-start tier picker. Reads intent sources (handoff doc / memory / first prompt), picks tier, refuses mid-session switching. |
| `skills/writing-handoffs/` | Skill - appends `## Recommended Model` section to handoff docs and stores a `session-handoff-…` memory entry. |
| `hooks/precompact-context.sh` | PreCompact hook - injects MEMORY.md + CLAUDE.md into compaction context. |
| `hooks/picking-model-tier-context.sh` | SessionStart hook - forces `picking-model-tier` to fire as the first skill of every session, ahead of brainstorming / debugging / etc. |
| `docs/workflow.md` | Human-readable one-page playbook (companion to `plugin-routing.md` which is for Claude). |
| `docs/superpowers/specs/` | Design docs for workflow improvements (model-switching policy, forcing functions, etc.). |
| `docs/superpowers/plans/` | Implementation plans derived from specs. |

## What this repo does NOT contain

- `~/.claude/settings.json` - has machine-specific paths; per-machine state
- `~/.claude/projects/*/memory/` - per-project memory snapshots
- Project-specific skills (those live in the project's repo)

## Origin

Spun out from `jem0ntr053/dotfiles` on 2026-04-27. See `MIGRATED.md`.
