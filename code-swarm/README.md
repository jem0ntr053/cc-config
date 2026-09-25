# code-swarm

Cross-repo issue swarm. `agent-ready` GitHub issues become verified PRs; a human always merges.

## Opt a repo in
Add `.swarm.json` at the repo root (schema: `skills/swarm/swarm.schema.json`):

```json
{ "armed": false, "test_cmd": ".venv/bin/python -m pytest -q", "main_branch": "main",
  "sca_cmd": "", "langs": ["python"], "conventions": "CLAUDE.md" }
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
`node scripts/test_swarm.mjs` and `bash scripts/test_swarm_nightly.sh` (both stubbed, no real agents).
