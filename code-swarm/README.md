# code-swarm

Cross-repo issue swarm. `agent-ready` GitHub issues become verified PRs; a human always merges.

## Opt a repo in
Add `.swarm.json` at the repo root (schema: `skills/swarm/swarm.schema.json`):

```json
{ "armed": false, "test_cmd": ".venv/bin/python -m pytest -q", "main_branch": "main",
  "sca_cmd": "", "langs": ["python"], "conventions": "CLAUDE.md", "jev": { "mode": "shadow" } }
```

`armed: false` allows only `--dry-run`, `--audit` and `--build`. The repo also needs the labels
`feature design-review agent-ready pr-open needs-human swarm-found security tests`.
Worktree agents cannot `source` a venv; point `test_cmd` at the venv's python directly.

## Run
`/swarm` (or `/code-swarm:swarm` where a repo still has its own `swarm` skill):
`--dry-run`, `--audit`, `--docs`, `--issue N`, `--build "<prompt>"`.

## Nightly (outside this repo)
`scripts/swarm_nightly.sh` runs `--audit` then `--dry-run` on each repo in its allowlist and posts one
ntfy digest. It is scheduled by `~/Library/LaunchAgents/com.montrose.swarm-nightly.plist` (03:00 daily,
sets `SWARM_NTFY_TOPIC`), which is not committed. Log: `/tmp/swarm-nightly.log`.
Load: `launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.montrose.swarm-nightly.plist`.

## Checks
`node scripts/test_swarm.mjs`, `bash scripts/test_swarm_nightly.sh` and `python3 scripts/test_jev.py`
(all stubbed/offline, no real agents, no key).

## Jev gates
`scripts/jev.py <battery> <state.json> [--gate <name>] [--mode shadow|enforce|off] [--agent-did '<json>']`
prints Jev's answers as JSON, fails open (`{"skipped": true, ...}`, exit 0) with no key or any error,
and appends a line to `~/.cache/code-swarm/jev.jsonl` (`JEV_LOG` overrides the path; `JEV_REPO` overrides the logged repo name, which otherwise comes from git or, outside a checkout, the cwd basename; /swarm sets it for every agent). Key: `TYPESAFE_API_KEY`
env or `~/.config/typesafe/.env`. One-line SDK setup:
`python3 -m venv ~/.cache/code-swarm/venv && ~/.cache/code-swarm/venv/bin/pip install typesafe-sdk`
(Homebrew python refuses `pip --user`; jev.py finds the venv's site-packages itself).

`.swarm.json` `jev.mode` (`shadow` default, `enforce`, `off`) drives gate 2 in `/swarm` pre-flight: shadow adds a `jev` column to the queue table; enforce relabels/drops issues per the spec rules and routes `tier: opus` issues to an opus implementer; off skips the CLI.
The same mode also drives gates 1, 3, and 4 inside pr-verifier (battery `verifier_leniency`), issue-filer (`finding_dedup`), and product-planner (`feature_sizing`): shadow logs only, enforce applies the spec Addition 3 rules (force `changes_requested` on observed divergence; skip/`possible-dup: #N` findings; split oversized features), off skips the CLI.
