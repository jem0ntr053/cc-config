# cc-config bootstrap - design

**Date:** 2026-04-27
**Topic:** Extract cross-project Claude Code workflow config from `jem0ntr053/dotfiles` into a new private repo (`jem0ntr053/cc-config`) and migrate the workflow improvement design issues with it.
**Brainstorm origin:** Issue dotfiles#79 META, raised mid-session during brainstorm of dotfiles#75 (model-switching policy).

---

## Goal

Establish a clean home for cross-project Claude Code workflow config (skills, hooks, plugin-routing.md, workflow design docs) so that:

1. The dotfiles repo stops loading workflow-design context every session it opens
2. The architecture stops being inconsistent (today: half cross-project via stow, half dotfiles-only)
3. The workflow improvement initiative has a coherent home where its issues, specs, and source live together

---

## Decisions (locked during brainstorm)

| # | Question | Decision |
|---|----------|----------|
| 1 | Scope | **Option 2** - all cross-project Claude config (generic skills, plugin-routing.md, hooks, workflow design docs). Project-specific skills (`dotfiles-*`) stay in dotfiles. |
| 2 | Install mechanism | **Option B** - plain `ln -sf` script. No Stow / chezmoi for this repo (small enough to not warrant a tool). Stow remains in dotfiles. |
| 3 | Hosting + name | Private GitHub repo, named `cc-config`. |
| 4 | Issue location | **Choice X** - workflow design issues (dotfiles#75/76/77/78/79) move to cc-config. Operational issues (#70/71/72 PowerShell, #80 chezmoi, sketchybar polish, etc.) stay in dotfiles. |
| 5 | Code migration approach | **Option F** - fresh start. No `git filter-repo` history preservation. `MIGRATED.md` records origin. |

Rationales for each are in the brainstorm transcript on dotfiles#75 (saved as a comment).

---

## Architecture

### Repo layout

```
cc-config/
├── README.md                             # purpose, install command, file inventory
├── MIGRATED.md                           # one-time origin note
├── install.sh                            # ln -sf installer (idempotent)
├── plugin-routing.md                     # canonical token-aware routing reference
├── skills/
│   ├── picking-model-tier/SKILL.md
│   └── writing-handoffs/SKILL.md
├── hooks/
│   ├── precompact-context.sh             # adopted from previously-untracked ~/.claude/hooks/
│   └── (require-branch-on-edit.sh - added later via cc-config issue C)
└── docs/
    ├── workflow.md                       # human-readable playbook
    └── superpowers/
        ├── specs/                        # design docs (this file lives here)
        └── plans/                        # implementation plans
```

### Install mechanism

`install.sh` symlinks specific paths into `~/.claude/`:

```bash
ln -sfn "$SOURCE/plugin-routing.md"           "$TARGET/plugin-routing.md"
ln -sfn "$SOURCE/skills/picking-model-tier"   "$TARGET/skills/picking-model-tier"
ln -sfn "$SOURCE/skills/writing-handoffs"     "$TARGET/skills/writing-handoffs"
ln -sfn "$SOURCE/hooks/precompact-context.sh" "$TARGET/hooks/precompact-context.sh"
```

The `-sfn` flag triplet:
- `-s` symbolic
- `-f` force-overwrite existing target
- `-n` no-deref-target (correctly replaces existing dir symlinks instead of nesting inside them)

Re-running the script after `git pull` is safe and refreshes targets.

### What this repo deliberately omits

- `~/.claude/settings.json` - contains machine-specific paths and per-machine permission state
- `~/.claude/projects/<sanitized-cwd>/memory/` - per-project session-recall hints, not portable
- Project-specific skills (`dotfiles-*` etc.) - those live with their project's source

---

## Migration plan (high-level - detailed implementation plan in `docs/superpowers/plans/`)

1. ✅ **Bootstrap empty repo** - create on GitHub, init locally, scaffold dirs, write README/MIGRATED/install.sh, first commit
2. **Copy files into cc-config:**
   - `dotfiles/common/.claude/plugin-routing.md` → `cc-config/plugin-routing.md`
   - `dotfiles/common/.claude/skills/picking-model-tier/` → `cc-config/skills/picking-model-tier/`
   - `dotfiles/common/.claude/skills/writing-handoffs/` → `cc-config/skills/writing-handoffs/`
   - `~/.claude/hooks/precompact-context.sh` → `cc-config/hooks/precompact-context.sh`
   - `dotfiles` PR #74 branch's `docs/workflow.md` → `cc-config/docs/workflow.md`
3. **Run install.sh** - verify all four symlinks resolve via `readlink`
4. **Verify Claude Code still finds skills** - start fresh `claude` session, confirm `picking-model-tier` and `writing-handoffs` are listed in available skills
5. **Branch in dotfiles, remove migrated content:**
   - Delete `common/.claude/plugin-routing.md`, `common/.claude/skills/picking-model-tier/`, `common/.claude/skills/writing-handoffs/`
   - Update CLAUDE.md (remove file-map rows, update skill references if any)
   - Update `docs/file-map.md` similarly
   - PR + merge in dotfiles
6. **Verify skills still resolve after dotfiles cleanup** - symlinks now point to cc-config; confirm `readlink ~/.claude/skills/picking-model-tier` shows cc-config path
7. **Close PR #74** in dotfiles (workflow.md superseded by cc-config copy)
8. **Issue migration (Choice X):**
   - For each of dotfiles#75/76/77/78/79: `gh issue view <#> --json title,body --jq` → recreate via `gh issue create --repo jem0ntr053/cc-config`
   - Add comment to original: "Moved to cc-config#<new>"; close
   - Pin the new META in cc-config; unpin old in dotfiles, leave a "moved →" comment
9. **Resume A's spec write** in cc-config per the saved checkpoint comment on dotfiles#75 (no further design needed)

---

## Risks + mitigations

| Risk | Mitigation |
|------|------------|
| New install.sh broken → Claude Code can't find skills | Verify before deleting from dotfiles. Existing dotfiles symlinks remain intact until step 5. |
| Symlink conflicts on existing `~/.claude/skills/...` targets | `-sfn` flag overwrites. Pre-flight: `readlink ~/.claude/skills/picking-model-tier` to confirm starting state. |
| `~/.claude/hooks/precompact-context.sh` is currently a real file (not symlink) | Install.sh `-f` flag deletes the real file before symlinking. Verified with current contents already preserved in cc-config repo. |
| `@~/.claude/plugin-routing.md` reference in user's global CLAUDE.md breaks | Path stays valid - symlink continues to resolve, just points to cc-config now |
| Open PR #74 conflicts with dotfiles cleanup | Close #74 in step 7 before opening dotfiles cleanup PR |
| Issues lose linkage during migration | Cross-link via comments on both old and new issues; META in cc-config explicitly mentions origin |

---

## Out of scope (explicitly deferred)

- Migrating dotfiles install from Stow to chezmoi - tracked as dotfiles#80, deferred until workflow initiative stable
- Adopting `~/.claude/settings.json` into version control - has machine-specific paths, separate evaluation
- Adopting `~/.claude/projects/*/memory/` into version control - per-project, evaluate later
- Building the actual workflow improvements (model-switching rule, forcing functions, etc.) - separate specs that land in this repo after bootstrap

## Dependencies

None. The bootstrap is self-contained. After completion:
- A's spec write (model-switching policy) resumes in cc-config
- B/C/D brainstorms continue in cc-config
- Forcing functions (C) include the eventual `require-branch-on-edit.sh` which lands in `cc-config/hooks/`

## Success criteria

- `bash ~/cc-config/install.sh` exits 0 and all four symlinks resolve correctly
- Fresh `claude` session in any project (cc-config, dotfiles, somewhere unrelated) lists `picking-model-tier` and `writing-handoffs` in available skills
- `dotfiles` repo no longer contains `plugin-routing.md` or generic skills
- META + sub-issues #75-79 closed in dotfiles with cross-links; reopened in cc-config; META pinned in cc-config
- PR #74 closed in dotfiles
