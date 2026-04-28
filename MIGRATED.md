# Migration note

This repo's contents originated in `jem0ntr053/dotfiles`. On 2026-04-27 the cross-project Claude Code config (skills, plugin-routing.md, hooks, workflow design docs) was extracted into this repo as part of the workflow improvement initiative.

Reasons for the split:
- Conceptual: this config governs all projects, not just dotfiles
- Token cost: every dotfiles session was loading workflow design docs as context
- Architecture consistency: half the system was already cross-project (skills via stow), half was dotfiles-only (specs + workflow.md). The split unifies the model.

**Migration was a fresh start, not a `git filter-repo` history transplant.** If you need the original commit history of any moved file, see the dotfiles repo around commit `c6c8ef2` and the days following (PRs #50, #69, #73 are the most relevant).

Migrated GitHub issues:
- dotfiles#75 → workflow design (model-switching policy)
- dotfiles#76 → workflow design (phase → skill mapping)
- dotfiles#77 → workflow design (forcing functions)
- dotfiles#78 → workflow design (plugin-routing polish)
- dotfiles#79 (META) → top-level tracker

Issues that stayed in dotfiles (operational, dotfiles-specific):
- #66, #67 + #36–46 - sketchybar polish
- #70, #71, #72 - PowerShell improvements
- #80 - chezmoi evaluation
- #25, #24, #32 - misc dotfiles
