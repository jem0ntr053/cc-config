# cc-config bootstrap implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:subagent-driven-development (recommended) or superpowers-extended-cc:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate cross-project Claude Code config (skills, plugin-routing.md, hooks, workflow design docs) from `jem0ntr053/dotfiles` into the new `jem0ntr053/cc-config` repo, then clean up dotfiles and migrate the workflow improvement issues.

**Architecture:** Fresh-start migration (no `git filter-repo` history transplant). Files copied into cc-config; `install.sh` symlinks them into `~/.claude/`; dotfiles deletes its copies after verification proves cc-config installs are working. Workflow design issues (#75-79) recreated in cc-config; operational dotfiles issues stay in dotfiles.

**Tech Stack:** bash, git, gh CLI. No tests in the unit-test sense — verification is operational (`readlink`, fresh-session checks, `gh issue list`).

**Pre-requisites already complete:**
- ✅ cc-config repo created on GitHub (private) and cloned to `~/cc-config`
- ✅ Initial scaffold: README.md, MIGRATED.md, install.sh, dirs (skills/, hooks/, docs/superpowers/{specs,plans}/)
- ✅ Bootstrap design spec at `~/cc-config/docs/superpowers/specs/2026-04-27-cc-config-bootstrap-design.md`

---

### Task 0: Copy generic skills + plugin-routing.md from dotfiles into cc-config

**Goal:** Bring the cross-project Claude Code skills and the canonical routing reference into cc-config.

**Files:**
- Create: `~/cc-config/plugin-routing.md` (copy of `~/dotfiles/common/.claude/plugin-routing.md`)
- Create: `~/cc-config/skills/picking-model-tier/SKILL.md` (copy from dotfiles)
- Create: `~/cc-config/skills/writing-handoffs/SKILL.md` (copy from dotfiles)

**Acceptance Criteria:**
- [ ] `~/cc-config/plugin-routing.md` exists with content byte-identical to dotfiles version
- [ ] `~/cc-config/skills/picking-model-tier/SKILL.md` exists, content matches
- [ ] `~/cc-config/skills/writing-handoffs/SKILL.md` exists, content matches
- [ ] Committed + pushed to cc-config main

**Verify:**
```bash
diff ~/dotfiles/common/.claude/plugin-routing.md ~/cc-config/plugin-routing.md
diff ~/dotfiles/common/.claude/skills/picking-model-tier/SKILL.md ~/cc-config/skills/picking-model-tier/SKILL.md
diff ~/dotfiles/common/.claude/skills/writing-handoffs/SKILL.md ~/cc-config/skills/writing-handoffs/SKILL.md
```
Expected: zero output for all three (identical files).

**Steps:**

- [ ] **Step 1: Copy plugin-routing.md**

```bash
cp ~/dotfiles/common/.claude/plugin-routing.md ~/cc-config/plugin-routing.md
```

- [ ] **Step 2: Copy picking-model-tier skill**

```bash
cp -R ~/dotfiles/common/.claude/skills/picking-model-tier ~/cc-config/skills/picking-model-tier
```

- [ ] **Step 3: Copy writing-handoffs skill**

```bash
cp -R ~/dotfiles/common/.claude/skills/writing-handoffs ~/cc-config/skills/writing-handoffs
```

- [ ] **Step 4: Verify content matches**

```bash
diff ~/dotfiles/common/.claude/plugin-routing.md ~/cc-config/plugin-routing.md
diff -r ~/dotfiles/common/.claude/skills/picking-model-tier ~/cc-config/skills/picking-model-tier
diff -r ~/dotfiles/common/.claude/skills/writing-handoffs ~/cc-config/skills/writing-handoffs
```
Expected: zero output (identical).

- [ ] **Step 5: Commit + push**

```bash
cd ~/cc-config
git add plugin-routing.md skills/
git -c commit.gpgsign=false commit -m "feat: import generic skills + plugin-routing.md from dotfiles"
git push
```

---

### Task 1: Adopt precompact-context.sh hook into cc-config

**Goal:** Bring the (currently untracked) PreCompact hook into version control as part of cc-config.

**Files:**
- Create: `~/cc-config/hooks/precompact-context.sh` (copy of `~/.claude/hooks/precompact-context.sh`)

**Acceptance Criteria:**
- [ ] `~/cc-config/hooks/precompact-context.sh` exists with content byte-identical to `~/.claude/hooks/precompact-context.sh`
- [ ] File is executable
- [ ] Committed + pushed to cc-config main

**Verify:**
```bash
diff ~/.claude/hooks/precompact-context.sh ~/cc-config/hooks/precompact-context.sh
test -x ~/cc-config/hooks/precompact-context.sh && echo OK
```
Expected: zero diff output, "OK".

**Steps:**

- [ ] **Step 1: Copy hook**

```bash
cp ~/.claude/hooks/precompact-context.sh ~/cc-config/hooks/precompact-context.sh
chmod +x ~/cc-config/hooks/precompact-context.sh
```

- [ ] **Step 2: Verify content + executable**

```bash
diff ~/.claude/hooks/precompact-context.sh ~/cc-config/hooks/precompact-context.sh
test -x ~/cc-config/hooks/precompact-context.sh && echo OK
```
Expected: zero diff, "OK".

- [ ] **Step 3: Commit + push**

```bash
cd ~/cc-config
git add hooks/precompact-context.sh
git -c commit.gpgsign=false commit -m "feat: adopt precompact-context.sh hook (was untracked in ~/.claude/hooks/)"
git push
```

---

### Task 2: Move workflow.md from dotfiles PR #74 into cc-config

**Goal:** Migrate the human-readable workflow playbook drafted in dotfiles PR #74 (unmerged) into cc-config so it lives with the other workflow design docs. Update internal links to point to cc-config locations.

**Files:**
- Create: `~/cc-config/docs/workflow.md` (adapted from `dotfiles@add-workflow-doc:docs/workflow.md`)

**Acceptance Criteria:**
- [ ] `~/cc-config/docs/workflow.md` exists with content from the PR #74 branch
- [ ] Internal links point to cc-config paths or stable absolute paths (no broken `../CLAUDE.md` references)
- [ ] Committed + pushed to cc-config main

**Verify:**
```bash
test -f ~/cc-config/docs/workflow.md && echo OK
grep -E '\.\./CLAUDE\.md|\.\./common/' ~/cc-config/docs/workflow.md && echo "BAD LINKS" || echo "links OK"
```
Expected: "OK" then "links OK".

**Steps:**

- [ ] **Step 1: Fetch workflow.md content from PR #74 branch**

```bash
git -C ~/dotfiles show add-workflow-doc:docs/workflow.md > /tmp/workflow-original.md
wc -l /tmp/workflow-original.md
```
Expected: ~117 lines.

- [ ] **Step 2: Adapt internal links and write to cc-config**

The original references `../CLAUDE.md` and `../common/.claude/plugin-routing.md` (relative to dotfiles). After migration:
- `plugin-routing.md` lives in cc-config root → reference as `../plugin-routing.md` (relative to docs/)
- `CLAUDE.md` reference becomes a stable URL since cc-config has no CLAUDE.md → update or drop
- `file-map.md` reference is dotfiles-specific → keep as absolute GitHub URL or drop

```bash
# Read /tmp/workflow-original.md, edit the "See also" section so:
#   [`CLAUDE.md`](../CLAUDE.md)                                  → drop (cc-config has no CLAUDE.md)
#   [`docs/file-map.md`](file-map.md)                            → drop (dotfiles-specific)
#   [`~/.claude/plugin-routing.md`](../common/.claude/...)        → [`plugin-routing.md`](../plugin-routing.md)
#
# Easiest: read the original, hand-edit the "See also" block, write the result
# to ~/cc-config/docs/workflow.md.
```

The replacement "See also" section should be:

```markdown
## See also

- [`plugin-routing.md`](../plugin-routing.md) — technical routing reference (for Claude)
- [Spec: model-switching policy](superpowers/specs/2026-04-27-model-switching-policy-design.md) — once written
- [META issue](https://github.com/jem0ntr053/cc-config/issues/) — current workflow improvement work
```

Use the Write tool (or `tee`) to create the final file with this section replaced. Everything else (overview, sections, tables) stays identical.

- [ ] **Step 3: Verify file + links**

```bash
test -f ~/cc-config/docs/workflow.md && echo OK
grep -E '\.\./CLAUDE\.md|\.\./common/' ~/cc-config/docs/workflow.md && echo "BAD LINKS" || echo "links OK"
wc -l ~/cc-config/docs/workflow.md
```
Expected: "OK", "links OK", ~117 ± a few lines.

- [ ] **Step 4: Commit + push**

```bash
cd ~/cc-config
git add docs/workflow.md
git -c commit.gpgsign=false commit -m "feat: import workflow.md from dotfiles PR #74 (closes that PR's intent)"
git push
```

---

### Task 3: Run cc-config install.sh and verify all symlinks point to cc-config

**Goal:** Activate cc-config — run its installer, then prove the four expected symlinks resolve into cc-config and not dotfiles.

**Files:**
- Modify (via symlink): `~/.claude/plugin-routing.md`, `~/.claude/skills/picking-model-tier`, `~/.claude/skills/writing-handoffs`, `~/.claude/hooks/precompact-context.sh`

**Acceptance Criteria:**
- [ ] `bash ~/cc-config/install.sh` exits 0
- [ ] All four symlinks resolve to cc-config paths (not dotfiles, not the old real-file location)

**Verify:**
```bash
readlink ~/.claude/plugin-routing.md           # expect: /Users/montrose/cc-config/plugin-routing.md
readlink ~/.claude/skills/picking-model-tier   # expect: /Users/montrose/cc-config/skills/picking-model-tier
readlink ~/.claude/skills/writing-handoffs     # expect: /Users/montrose/cc-config/skills/writing-handoffs
readlink ~/.claude/hooks/precompact-context.sh # expect: /Users/montrose/cc-config/hooks/precompact-context.sh
```

**Steps:**

- [ ] **Step 1: Pre-flight — record current symlink state**

```bash
echo "=== before install ==="
for p in ~/.claude/plugin-routing.md ~/.claude/skills/picking-model-tier ~/.claude/skills/writing-handoffs ~/.claude/hooks/precompact-context.sh; do
  printf "%-50s -> " "$p"
  readlink "$p" 2>/dev/null || echo "(not a symlink or absent)"
done
```
Expected: first three point into dotfiles; fourth is "not a symlink" (real file currently).

- [ ] **Step 2: Run install.sh**

```bash
bash ~/cc-config/install.sh
echo "exit: $?"
```
Expected: prints install line + symlink table; exit 0.

- [ ] **Step 3: Verify all four symlinks point to cc-config**

```bash
echo "=== after install ==="
for p in ~/.claude/plugin-routing.md ~/.claude/skills/picking-model-tier ~/.claude/skills/writing-handoffs ~/.claude/hooks/precompact-context.sh; do
  target=$(readlink "$p")
  case "$target" in
    /Users/montrose/cc-config/*) echo "OK   $p -> $target" ;;
    *) echo "BAD  $p -> $target" ;;
  esac
done
```
Expected: four lines all starting with "OK".

- [ ] **Step 4: Verify the precompact hook still produces valid output**

```bash
echo '{"workspace":{"current_dir":"/Users/montrose/dotfiles"}}' | bash ~/.claude/hooks/precompact-context.sh > /tmp/precompact-test.json
echo "exit: $?"
jq -r '.hookSpecificOutput.hookEventName' /tmp/precompact-test.json
echo "ctx-len: $(jq -r '.hookSpecificOutput.additionalContext | length' /tmp/precompact-test.json)"
```
Expected: exit 0, "PreCompact", non-zero ctx-len.

If anything fails: the original `~/.claude/hooks/precompact-context.sh` content is preserved in `~/cc-config/hooks/precompact-context.sh` — restore via `cp ~/cc-config/hooks/precompact-context.sh ~/.claude/hooks/precompact-context.sh` (without symlink).

---

### Task 4: Verify Claude Code finds picking-model-tier and writing-handoffs skills via cc-config symlinks

**Goal:** Confirm Claude Code's skill discovery still finds the two skills now that they resolve through cc-config instead of dotfiles.

**Files:** None modified.

**Acceptance Criteria:**
- [ ] In a fresh `claude` session, `picking-model-tier` and `writing-handoffs` appear in the available-skills system reminder list
- [ ] Both skills can be invoked successfully (test by invoking `picking-model-tier` and reading its content)

**Verify:** This is a manual verification (requires a fresh Claude Code session). The agent executing this plan should:

```bash
# In a fresh shell, start a new claude session in any directory:
cd /tmp && claude
# Then in that session:
#   /skills        # or whatever lists skills, depending on CLI version
# Or just try invoking:
#   "Invoke the picking-model-tier skill"
```

**Steps:**

- [ ] **Step 1: Open a fresh `claude` session in a different terminal or `/clear` this one** (this turn-out boundary is a manual user action — agent dispatching plan should ask the user to confirm)

- [ ] **Step 2: Verify the system-reminder available-skills list includes both** (look for lines like `- picking-model-tier: ...` and `- writing-handoffs: ...`)

- [ ] **Step 3: Invoke `picking-model-tier` and confirm SKILL.md content loads** (no "skill not found" error)

- [ ] **Step 4: Repeat for `writing-handoffs`**

If either fails: do NOT proceed to Task 5 (which deletes from dotfiles). Investigate first — likely cause is wrong symlink target or Claude Code cache.

---

### Task 5: Remove migrated files from dotfiles + update file-map.md

**Goal:** Delete the now-redundant cross-project files from dotfiles. Update `docs/file-map.md` to remove their rows. CLAUDE.md needs no change (the `@~/.claude/plugin-routing.md` import still resolves via the new symlink).

**Files:**
- Delete from dotfiles: `common/.claude/plugin-routing.md`
- Delete from dotfiles: `common/.claude/skills/picking-model-tier/` (and parent if empty)
- Delete from dotfiles: `common/.claude/skills/writing-handoffs/` (and parent if empty)
- Modify: `~/dotfiles/docs/file-map.md` — remove the three rows for the deleted files

**Acceptance Criteria:**
- [ ] Files removed from dotfiles main (after PR merge)
- [ ] file-map.md no longer references the removed paths
- [ ] PR merged via `gh pr merge --squash --delete-branch`

**Verify:**
```bash
# After merge:
cd ~/dotfiles && git pull
test ! -e common/.claude/plugin-routing.md && echo "plugin-routing removed"
test ! -e common/.claude/skills/picking-model-tier && echo "picking-model-tier removed"
test ! -e common/.claude/skills/writing-handoffs && echo "writing-handoffs removed"
grep -E 'plugin-routing|picking-model-tier|writing-handoffs' docs/file-map.md && echo "FAIL stale refs" || echo "file-map clean"
```
Expected: three "removed" lines + "file-map clean".

**Steps:**

- [ ] **Step 1: Branch in dotfiles**

```bash
cd ~/dotfiles
git checkout main && git pull
git checkout -b cleanup/post-cc-config-extraction
```

- [ ] **Step 2: Remove the migrated files**

```bash
git rm common/.claude/plugin-routing.md
git rm -r common/.claude/skills/picking-model-tier
git rm -r common/.claude/skills/writing-handoffs
git status
```

- [ ] **Step 3: Update docs/file-map.md**

Open `~/dotfiles/docs/file-map.md` and remove the three rows referring to:
- `common/.claude/plugin-routing.md`
- `common/.claude/skills/picking-model-tier/SKILL.md`
- `common/.claude/skills/writing-handoffs/SKILL.md`

Leave the `dotfiles-*` skill rows intact (those stay in dotfiles).

After edit, verify:

```bash
grep -E 'plugin-routing|picking-model-tier|writing-handoffs' ~/dotfiles/docs/file-map.md && echo "FAIL stale refs" || echo "clean"
```
Expected: "clean".

- [ ] **Step 4: Commit + push**

```bash
cd ~/dotfiles
git add docs/file-map.md
git commit -m "$(cat <<'EOF'
chore: extract cross-project Claude config to cc-config repo

Removes plugin-routing.md, picking-model-tier skill, and
writing-handoffs skill from dotfiles. These now live in
jem0ntr053/cc-config and are symlinked into ~/.claude/ via that
repo's install.sh. Dotfiles-specific skills (dotfiles-*) stay here.

The @~/.claude/plugin-routing.md import in this repo's CLAUDE.md
continues to resolve correctly — only the symlink target changed.

Co-extraction: closes follow-up to PRs #69 and #73; superseded
PR #74 (workflow.md moved to cc-config).
EOF
)"
git push -u origin cleanup/post-cc-config-extraction
```

- [ ] **Step 5: Open PR + merge**

```bash
gh pr create --title "chore: extract cross-project Claude config to cc-config repo" --body "$(cat <<'EOF'
## Summary
Extracts the cross-project Claude Code config (plugin-routing.md, picking-model-tier skill, writing-handoffs skill) from dotfiles into the new private \`jem0ntr053/cc-config\` repo. These were already cross-project in spirit (stowed into \`~/.claude/\`) — now they live with the rest of the cross-project workflow improvement work.

After merge, dotfiles stops loading workflow design context every session — savings repeat per-session.

## Verification (already done before opening this PR)
- cc-config repo bootstrapped, install.sh symlinks all four targets correctly
- Fresh Claude session loads picking-model-tier and writing-handoffs from cc-config paths
- precompact-context.sh hook still produces valid output

## Out of scope
- Workflow design issues #75-79 migrate to cc-config in a separate gh-only step (no PR needed)
- PR #74 (workflow.md draft) closed without merge — content moved to cc-config
EOF
)"

# After CI/check (none here), merge:
gh pr merge --squash --delete-branch
```

- [ ] **Step 6: Sync local main**

```bash
cd ~/dotfiles && git checkout main && git pull
```

- [ ] **Step 7: Run verification block from Acceptance Criteria** (commands at top of task)

---

### Task 6: Verify symlinks still resolve and skills still load post-dotfiles-cleanup

**Goal:** Sanity check after the dotfiles deletion — symlinks must still point into cc-config (they should, untouched by dotfiles changes) and skills must still load.

**Files:** None modified.

**Acceptance Criteria:**
- [ ] All four `~/.claude/...` symlinks still resolve into cc-config
- [ ] Fresh Claude session still finds and can invoke both skills
- [ ] `dotfiles-*` skills still resolve (their symlinks were untouched)

**Verify:**
```bash
for p in ~/.claude/plugin-routing.md ~/.claude/skills/picking-model-tier ~/.claude/skills/writing-handoffs ~/.claude/hooks/precompact-context.sh; do
  target=$(readlink "$p")
  case "$target" in
    /Users/montrose/cc-config/*) echo "OK   $p -> $target" ;;
    *) echo "BAD  $p -> $target" ;;
  esac
done

# dotfiles-* skills should still point to dotfiles
for s in dotfiles-aerospace dotfiles-mcp dotfiles-nvim dotfiles-security dotfiles-shell dotfiles-sketchybar; do
  target=$(readlink "$HOME/.claude/skills/$s")
  case "$target" in
    /Users/montrose/dotfiles/*) echo "OK   $s -> $target" ;;
    *) echo "BAD  $s -> $target" ;;
  esac
done
```
Expected: 10 lines all starting with "OK".

**Steps:**

- [ ] **Step 1: Run readlink verification block** (above)

- [ ] **Step 2: Manual — fresh `claude` session, confirm both cc-config-served skills still listed**

If anything is "BAD": investigate immediately. cc-config symlinks should not have changed. dotfiles symlinks for `dotfiles-*` skills are unaffected by this migration.

---

### Task 7: Close dotfiles PR #74 (workflow.md draft, superseded by cc-config copy)

**Goal:** Close the unmerged dotfiles PR that drafted `docs/workflow.md`, since that file now lives in cc-config.

**Files:** None modified locally — GitHub-only operation.

**Acceptance Criteria:**
- [ ] Dotfiles PR #74 is closed (not merged)
- [ ] Branch `add-workflow-doc` deleted from origin

**Verify:**
```bash
gh pr view 74 --repo jem0ntr053/dotfiles --json state -q .state
```
Expected: `CLOSED`.

**Steps:**

- [ ] **Step 1: Close PR with explanatory comment**

```bash
gh pr close 74 --repo jem0ntr053/dotfiles --comment "$(cat <<'EOF'
Superseded by the cc-config bootstrap migration (2026-04-27). \`docs/workflow.md\` now lives at https://github.com/jem0ntr053/cc-config/blob/main/docs/workflow.md.

The dotfiles repo no longer carries cross-project workflow docs — see the cleanup PR that removes plugin-routing.md and the generic skills.
EOF
)" --delete-branch
```

- [ ] **Step 2: Verify**

```bash
gh pr view 74 --repo jem0ntr053/dotfiles --json state -q .state
git -C ~/dotfiles fetch --prune
```
Expected: `CLOSED`, branch removed locally too.

---

### Task 8: Migrate workflow design issues #75-79 from dotfiles to cc-config

**Goal:** Recreate the workflow design issues (sub-issues A/B/C/D and the META) in cc-config. Cross-link old and new. Pin the new META in cc-config.

**Files:** None local — GitHub-only.

**Acceptance Criteria:**
- [ ] Five new issues exist in cc-config (one per migrated dotfiles issue)
- [ ] Each new issue's body matches the original (with internal references updated to point to new cc-config issue numbers where applicable)
- [ ] Each old dotfiles issue has a comment "Moved to cc-config#<new>" and is closed
- [ ] cc-config META pinned; dotfiles META unpinned with "moved" comment
- [ ] cc-config META's checkbox list references the new (cc-config) sub-issue numbers, not dotfiles ones

**Verify:**
```bash
# All five recreated:
gh issue list --repo jem0ntr053/cc-config --state open --json number,title

# All five originals closed:
for n in 75 76 77 78 79; do
  printf "dotfiles#%s state: " "$n"
  gh issue view "$n" --repo jem0ntr053/dotfiles --json state -q .state
done

# Pinned in cc-config:
gh issue list --repo jem0ntr053/cc-config --state open --json number,title,isPinned --jq '.[] | select(.isPinned)'
```
Expected: five-line listing, five "CLOSED", one pinned issue (the META).

**Steps:**

- [ ] **Step 1: Migrate sub-issues A (#75), B (#76), C (#77), D (#78)**

For each old number $N$, do the following loop. Run sequentially so we know the new issue numbers as we go (used in step 2 for the META).

```bash
for N in 75 76 77 78; do
  TITLE=$(gh issue view "$N" --repo jem0ntr053/dotfiles --json title -q .title)
  BODY=$(gh issue view "$N" --repo jem0ntr053/dotfiles --json body -q .body)
  # Recreate in cc-config
  NEW_URL=$(gh issue create --repo jem0ntr053/cc-config --title "$TITLE" --body "$BODY")
  NEW_NUM=$(echo "$NEW_URL" | grep -oE '[0-9]+$')
  echo "dotfiles#$N -> cc-config#$NEW_NUM"
  # Cross-link + close old
  gh issue comment "$N" --repo jem0ntr053/dotfiles --body "Moved to cc-config#$NEW_NUM ($NEW_URL)."
  gh issue close "$N" --repo jem0ntr053/dotfiles
done
```

Record the mapping (old → new) for use in step 2:

```
dotfiles#75 -> cc-config#__
dotfiles#76 -> cc-config#__
dotfiles#77 -> cc-config#__
dotfiles#78 -> cc-config#__
```

Also note: the comment on dotfiles#75 carries the "checkpoint" of the model-switching brainstorm. Re-post that comment on the new cc-config issue too — it's load-bearing for resuming A:

```bash
# Get the checkpoint comment body from dotfiles#75 (the comment we added earlier)
gh issue view 75 --repo jem0ntr053/dotfiles --comments --json comments \
  --jq '.comments[] | select(.body | startswith("## Brainstorm checkpoint")) | .body' > /tmp/checkpoint.md

# Post to the new cc-config A issue (use the new # from the mapping)
gh issue comment <NEW_A_NUMBER> --repo jem0ntr053/cc-config --body-file /tmp/checkpoint.md
```

- [ ] **Step 2: Migrate META #79 with updated cross-references**

```bash
# Pull the original META body
gh issue view 79 --repo jem0ntr053/dotfiles --json body -q .body > /tmp/meta-body.md

# In /tmp/meta-body.md, manually edit:
#   - "#75" → "cc-config#<new A>"
#   - "#76" → "cc-config#<new B>"
#   - "#77" → "cc-config#<new C>"
#   - "#78" → "cc-config#<new D>"
#   - References to dotfiles operational issues (#70, #71, #72, #80, #66, #67, etc.)
#       → keep as "dotfiles#NN" with explicit repo prefix
#   - The "## ⚠️ Current state" pivot section can be replaced with
#     "## State: bootstrap complete" + brief note that the repo is now cc-config

# Then create the new META:
NEW_META_URL=$(gh issue create --repo jem0ntr053/cc-config --title "META: workflow + flow trust improvements" --body-file /tmp/meta-body.md)
NEW_META_NUM=$(echo "$NEW_META_URL" | grep -oE '[0-9]+$')
echo "META: dotfiles#79 -> cc-config#$NEW_META_NUM"

# Pin in cc-config
gh issue pin "$NEW_META_NUM" --repo jem0ntr053/cc-config

# Comment + close old META
gh issue comment 79 --repo jem0ntr053/dotfiles --body "Moved to cc-config#$NEW_META_NUM ($NEW_META_URL). The workflow improvement initiative now lives in jem0ntr053/cc-config."

# Unpin old META (must be done before close on some gh versions; do it first)
gh issue unpin 79 --repo jem0ntr053/dotfiles 2>/dev/null || true
gh issue close 79 --repo jem0ntr053/dotfiles
```

- [ ] **Step 3: Verify**

```bash
gh issue list --repo jem0ntr053/cc-config --state open
for n in 75 76 77 78 79; do
  printf "dotfiles#%s: " "$n"
  gh issue view "$n" --repo jem0ntr053/dotfiles --json state -q .state
done
gh issue list --repo jem0ntr053/cc-config --json number,title,isPinned --jq '.[] | select(.isPinned)'
```
Expected: five new cc-config issues; five dotfiles closures; one pinned cc-config META.

---

## Self-review notes

**Spec coverage:**
- ✅ Bootstrap empty repo — already done (pre-requisite)
- ✅ Copy files (skills, plugin-routing.md, hook, workflow.md) — Tasks 0, 1, 2
- ✅ Run install.sh + verify symlinks — Task 3
- ✅ Verify Claude Code finds skills — Task 4
- ✅ Branch in dotfiles, remove migrated content + update file-map.md — Task 5
- ✅ Verify post-cleanup — Task 6
- ✅ Close PR #74 — Task 7
- ✅ Issue migration — Task 8
- ✅ Resume A's spec write — explicitly out of scope (success criterion of bootstrap is "cc-config functional + issues migrated"; A is follow-up)

**Type/path consistency:**
- All paths use `~/cc-config/` and `~/dotfiles/` consistently
- All commands use `gh` flags consistently

**Risk coverage:**
- Task 3 has rollback note (restore real-file hook from cc-config copy)
- Task 4 explicit "do NOT proceed to Task 5 if verification fails"
- Task 6 catches any regression caused by Task 5

**Open assumption:** Step 3 of Task 2 (workflow.md link adaptation) is somewhat manual — the agent executing should use Read + Edit tools rather than scripted sed, since the link structure is best done with eyes on the content. Documented inline in the task.
