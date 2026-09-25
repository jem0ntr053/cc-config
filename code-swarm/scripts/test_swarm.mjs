// Runs swarm.js under a stub Workflow runtime and asserts what it asks agents to do.
// Doubles as the syntax check: `node --check` rejects Workflow scripts' top-level return.
// Usage: node code-swarm/scripts/test_swarm.mjs
import { readFileSync } from "node:fs"
import assert from "node:assert/strict"

const SRC = readFileSync(new URL("../skills/swarm/swarm.js", import.meta.url), "utf8")
  .replace(/^export const meta/m, "const meta")
const AsyncFunction = (async () => {}).constructor
const script = new AsyncFunction("args", "agent", "parallel", "pipeline", "phase", "log", SRC)

const CANNED = {
  "issue-triager": { needs_human: false, reason: "", findings: [],
    brief: { issue: 9, branch: "b", commit_subject: "s", files: ["a.py"], steps: [], tests: [], targeted_pytest: "t", risk: "low", lang: "python" } },
  "feature-architect": { skip: false, approach: "x", findings: [] },
}

async function run(args) {
  const calls = []
  const agent = async (prompt, opts) => {
    calls.push({ prompt, ...opts })
    return CANNED[opts.agentType.replace(/^code-swarm:/, "")] ?? { findings: [], created: [], skipped_duplicate: [] }
  }
  const result = await script(args, agent, fns => Promise.all(fns.map(f => f())),
    (items, fn) => Promise.all(items.map(fn)), () => {}, () => {})
  return { calls, result }
}

const config = { root: "/r/dayos", test_cmd: ".venv/bin/python -m pytest -q", main_branch: "main", sca_cmd: "", langs: ["python"], conventions: "CLAUDE.md" }

// config flows into every prompt; agents resolve inside the plugin namespace
{
  const { calls } = await run({ issues: [9], dryRun: true, config })
  assert.ok(calls.length > 0)
  for (const c of calls) {
    assert.match(c.prompt, /Repo root: \/r\/dayos/)
    assert.match(c.prompt, /Test command: \.venv\/bin\/python -m pytest -q/)
    assert.match(c.prompt, /Read CLAUDE\.md before anything else/)
    assert.match(c.prompt, /No security scan command configured/)
    assert.match(c.agentType, /^code-swarm:/)
  }
}

// dry-run is read-only: no design agents, triager told not to write to GitHub
{
  const { calls, result } = await run({ issues: [9], features: [21], dryRun: true, config })
  assert.deepEqual(calls.map(c => c.agentType), ["code-swarm:issue-triager"])
  assert.match(calls[0].prompt, /DRY RUN/)
  assert.equal(result.dryRun, true)
  assert.equal(result.briefs.length, 1)
}

// a real run still designs features, and its triage prompt carries no dry-run marker
{
  const { calls } = await run({ issues: [], features: [21], config })
  assert.ok(calls.some(c => c.agentType === "code-swarm:feature-architect"))
  assert.ok(calls.every(c => !/DRY RUN/.test(c.prompt)))
}

console.log("OK")
