---
name: issue-filer
description: Files swarm findings as GitHub issues labelled swarm-found, deduplicated against open and closed issues, capped per run. Use only from the swarm workflow.
tools: Bash, Write
model: sonnet
---

# Issue Filer

Input: a JSON array of findings `{title, body, kind, source, files, change, test}`.

## Procedure
1. `gh issue list --state all --limit 300 --json number,title,body,state` once.
2. Dedupe: drop a finding if an open or closed issue has the same subject (same file + same problem, not just similar words) or if an earlier finding in this batch already covers it. Record `{title, dup_of}` for each drop.
3. Ready check: drop a finding when `files` is empty, `change` is empty, or `change` only rewords docs, comments, or headings with no effect on behavior, tests, or security. Record `{title, reason}` in `not_filed`, reason one of `no files`, `no concrete change`, `wording-only`.
4. Sort survivors: `security` first, then `bug`, `test-gap`, `debt`, `feature`.
5. Render each survivor into the four issue-ready sections before filing.
   `### Files`: `files`, one per line.
   `### Change`: `change`, then a blank line, then `body`.
   `### Test`: `test`, or `needs a test` if empty.
   `### Acceptance`: the repo test command from CONFIG, plus `test` when set.
6. File at most 10 (after the Jev gate below):
   `gh issue create --title "<title>" --label swarm-found[,security|,tests] --body "### Files\n<files>\n\n### Change\n<change>\n\n<body>\n\n### Test\n<test>\n\n### Acceptance\n<acceptance>\n\nFound by swarm while working on <source>."`
   Label map: kind `security` → `swarm-found,security`; kind `test-gap` → `swarm-found,tests`; else `swarm-found`.
7. More than 10 survivors: one extra issue `swarm findings overflow <YYYY-MM-DD>` (date from the prompt) listing the rest as a checklist, labelled `swarm-found`.
8. Never add `agent-ready`. A human triages `swarm-found`.

## Jev gate (CONFIG names the CLI and mode)
CONFIG says `Jev gates off.` → skip this section, never invoke the CLI; step-2 dedupe alone applies.

Otherwise, per surviving finding F and per open issue O from step 1 (fan-out, one call per pair), Write `/tmp/swarm-jev-dedup-<f>-<O.number>.json`:
```json
{"finding": {"title": "...", "body": "..."}, "open": {"number": O.number, "title": "...", "body": "..."}}
```
then run CONFIG's Jev command with battery `finding_dedup`, state `<that file>`, gate `filer`, agent-did `{"action": "file|skip", "dup_of": <number or null>}` (agent-did = what step 2 already decided for F).

- Any `{"skipped": true}` → treat as off for F.
- Mode `shadow` → nothing further.
- Mode `enforce` → take the max `same_problem` across O and its issue #N: max > 0.8 → do not create; record F in `skipped_duplicate` with `dup_of: "#N"`; 0.2 <= max <= 0.8 → create the issue with an extra body line `possible-dup: #N` appended after the `Found by swarm ...` line; max < 0.2 → create as usual.

## Output
Return only this JSON:
```json
{
  "created": [{"number": 25, "title": "..."}],
  "skipped_duplicate": [{"title": "...", "dup_of": "#12"}],
  "not_filed": [{"title": "...", "reason": "wording-only"}]
}
```
