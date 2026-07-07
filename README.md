# cc-config

Cross-project Claude Code workflow config. Hooks, generic skills, the canonical token-aware plugin-routing reference, and design docs for the workflow improvement initiative.

This repo contains config that should govern *every* Claude Code session, regardless of which project you're in. Per-project config (e.g. `dotfiles-*` skills) stays in the project's own repo.

## Install

```bash
git clone https://github.com/jem0ntr053/cc-config.git ~/cc-config
claude plugin marketplace add ~/cc-config
claude plugin install cc-config@cc-config-marketplace
```

`~/cc-config` is just a chosen path, not a tooling requirement — clone anywhere and pass that path to `marketplace add`. Clone-free alternative: `claude plugin marketplace add` also accepts a GitHub repo (`jem0ntr053/cc-config`) or git URL directly; use the git/GitHub-repo form, NOT a raw URL to `marketplace.json` — the raw-URL form silently breaks the relative `"source": "./"` plugin entry.

Plugin hooks register automatically — no settings.json wiring needed.

To refresh after `git pull`: `claude plugin marketplace update cc-config-marketplace && claude plugin update cc-config` (restart Claude Code to apply).

Bump `version` in `.claude-plugin/plugin.json` on every merged change to `skills/` or `hooks/`; `claude plugin tag` can stamp releases.

### Migrating from symlink install

After confirming the plugin fires in a fresh session (check that `picking-model-tier` / `cc-config:picking-model-tier` runs as the first skill), remove the old symlinks and manual `SessionStart` entry to avoid double-firing (hook dedup only matches identical command strings — the plugin's `${CLAUDE_PLUGIN_ROOT}` path and the old `$HOME/.claude/hooks/...` entry are different strings, so both would otherwise fire) and duplicate skills (bare name + `cc-config:`-namespaced).

**Warning:** `~/.claude/plugin-routing.md` is `@`-imported by the user's global `CLAUDE.md`. The plugin does NOT replace that import mechanism — `plugin-routing.md` must stay reachable at that path. Do NOT remove the `plugin-routing.md` symlink unless the global `CLAUDE.md` import is also updated to point at the repo copy instead.

```bash
rm ~/.claude/skills/picking-model-tier ~/.claude/skills/writing-handoffs ~/.claude/skills/session-debrief
rm ~/.claude/hooks/picking-model-tier-context.sh ~/.claude/hooks/precompact-context.sh
# then remove the picking-model-tier-context.sh SessionStart entry from ~/.claude/settings.json
```

Separate manual step (only after updating the global `CLAUDE.md` import per the warning above): `rm ~/.claude/plugin-routing.md`.

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
| `prompts/onboard-repo.md` | Per-repo onboarding prompt - paste the whole file as the first message of a fresh session at any target repo's root; sizes the repo, installs the guardrails kit, authors a project skill library. |
| `kit/` | Guardrails kit v1.0, vendored byte-verbatim (never hand-edit; hashes in `kit/MANIFEST.sha`). Installed into target repos by `kit/MIGRATE.md`, usable standalone per `kit/README.md`. |
| `plugin-routing.md` | Canonical token-aware tool/skill routing reference. Auto-loaded by the global CLAUDE.md via `@~/.claude/plugin-routing.md`. |
| `skills/picking-model-tier/` | Skill - session-start tier picker. Reads intent sources (handoff doc / memory / first prompt), picks tier, refuses mid-session switching. |
| `skills/writing-handoffs/` | Skill - appends `## Recommended Model` section to handoff docs and stores a `session-handoff-…` memory entry. |
| `skills/session-debrief/` | Skill - end-of-session ritual ("wrap up"): least-confident list, biggest-miss question, then routes to `writing-handoffs` if work continues. |
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
