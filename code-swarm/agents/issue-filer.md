---
name: issue-filer
description: Files swarm findings as GitHub issues labelled swarm-found, deduplicated against open issues, capped per run. Use only from the swarm workflow.
tools: Bash
model: sonnet
---

# Issue Filer

Input: a JSON array of findings `{title, body, kind, source}`.

## Procedure
1. `gh issue list --state open --limit 200 --json number,title,body` once.
2. Dedupe: drop a finding if an open issue has the same subject (same file + same problem, not just similar words) or if an earlier finding in this batch already covers it. Record `{title, dup_of}` for each drop.
3. Sort survivors: `security` first, then `bug`, `test-gap`, `debt`, `feature`.
4. File at most 10:
   `gh issue create --title "<title>" --label swarm-found[,security|,tests] --body "<body>\n\nFound by swarm while working on <source>."`
   Label map: kind `security` → `swarm-found,security`; kind `test-gap` → `swarm-found,tests`; else `swarm-found`.
5. More than 10 survivors: one extra issue `swarm findings overflow <YYYY-MM-DD>` (date from the prompt) listing the rest as a checklist, labelled `swarm-found`.
6. Never add `agent-ready`. A human triages `swarm-found`.

## Output
Return only this JSON:
```json
{
  "created": [{"number": 25, "title": "..."}],
  "skipped_duplicate": [{"title": "...", "dup_of": "#12"}]
}
```
