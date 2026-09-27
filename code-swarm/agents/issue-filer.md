---
name: issue-filer
description: Files swarm findings as GitHub issues labelled swarm-found, deduplicated against open issues, capped per run. Use only from the swarm workflow.
tools: Bash, Write
model: sonnet
---

# Issue Filer

Input: a JSON array of findings `{title, body, kind, source}`.

## Procedure
1. `gh issue list --state open --limit 200 --json number,title,body` once.
2. Dedupe: drop a finding if an open issue has the same subject (same file + same problem, not just similar words) or if an earlier finding in this batch already covers it. Record `{title, dup_of}` for each drop.
3. Sort survivors: `security` first, then `bug`, `test-gap`, `debt`, `feature`.
4. Render each survivor into the four issue-ready sections before filing.
   `### Files`: the finding's `source` when it is a repo path; otherwise (source is `#N`, `build`, or a PR url) every repo path mentioned in the finding body; if none, `needs human input`.
   `### Change`: the finding body verbatim.
   `### Test`: a runnable command or grep that would prove the change (derive from the body when it names a test file, command, or checkable string); else `needs human input`.
   `### Acceptance`: the repo test command from CONFIG plus any check derived from the body; else `needs human input`.
   If Test or Acceptance is `needs human input`, add the `needs-human` label to that issue.
5. File at most 10 (after the Jev gate below):
   `gh issue create --title "<title>" --label swarm-found[,security|,tests][,needs-human] --body "### Files\n<files>\n\n### Change\n<body>\n\n### Test\n<test>\n\n### Acceptance\n<acceptance>\n\nFound by swarm while working on <source>."`
   Label map: kind `security` → `swarm-found,security`; kind `test-gap` → `swarm-found,tests`; else `swarm-found`. Append `,needs-human` when Test or Acceptance is `needs human input`.
6. More than 10 survivors: one extra issue `swarm findings overflow <YYYY-MM-DD>` (date from the prompt) listing the rest as a checklist, labelled `swarm-found`.
7. Never add `agent-ready`. A human triages `swarm-found`; `needs-human` is the only other label the filer adds, and only per the rendering step.

## Jev gate (CONFIG names the CLI and mode)
CONFIG says `Jev gates off.` → skip this section, never invoke the CLI; step-2 dedupe alone applies.

Otherwise, per surviving finding F and per open issue O from step 1 (fan-out, one call per pair), Write `/tmp/swarm-jev-dedup-<f>-<O.number>.json`:
```json
{"finding": {"title": "...", "body": "..."}, "open": {"number": O.number, "title": "...", "body": "..."}}
```
then run `python3 <CLI> finding_dedup <that file> --gate filer --mode <mode> --agent-did '{"action": "file|skip", "dup_of": <number or null>}'` (agent-did = what step 2 already decided for F).

- Any `{"skipped": true}` → treat as off for F.
- Mode `shadow` → nothing further.
- Mode `enforce` → take the max `same_problem` across O and its issue #N: max > 0.8 → do not create; record F in `skipped_duplicate` with `dup_of: "#N"`; 0.2 <= max <= 0.8 → create the issue with an extra body line `possible-dup: #N` appended after the `Found by swarm ...` line; max < 0.2 → create as usual.

## Output
Return only this JSON:
```json
{
  "created": [{"number": 25, "title": "..."}],
  "skipped_duplicate": [{"title": "...", "dup_of": "#12"}]
}
```
