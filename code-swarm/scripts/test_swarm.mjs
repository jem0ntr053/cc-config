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
  "pr-verifier": { verdict: "approve", reasons: [], findings: [] },
  "issue-implementer": { status: "pr_open", pr_url: "u", pr_number: 1, branch: "b", findings: [] },
}

// respond(type, prompt) may override the canned reply; return undefined to fall through
async function run(args, respond = () => undefined) {
  const calls = []
  const agent = async (prompt, opts) => {
    calls.push({ prompt, ...opts })
    const type = opts.agentType.replace(/^code-swarm:/, "")
    const r = respond(type, prompt)
    if (r !== undefined) return r
    return CANNED[type] ?? { findings: [], created: [], skipped_duplicate: [] }
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
    assert.match(c.prompt, /Run git as \/usr\/bin\/git/)   // bare git → rtk git, which worktree isolation refuses
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

// --build: planner writes the spec, then one groomer per feature in order, citing earlier issue numbers
{
  const plan = { spec_path: "docs/specs/2026-09-24-todo.md", pr_url: "https://x/pull/5", findings: [],
    features: [{ n: 1, title: "tasks", depends_on: [] }, { n: 2, title: "tags", depends_on: [1] }, { n: 3, title: "digest", depends_on: [1, 2] }] }
  const issueFor = { 1: 101, 3: 103 }   // feature 2's groomer fails
  const { calls, result } = await run({ build: "todo list with tags", date: "2026-09-24", config }, (type, prompt) => {
    if (type === "product-planner") return plan
    if (type === "issue-groomer") {
      const n = Number(prompt.match(/feature: (\d+)/)[1])
      return issueFor[n] ? { created: [{ number: issueFor[n], title: `f${n}` }], skipped_duplicate: [] } : null
    }
  })
  assert.deepEqual(calls.map(c => c.agentType),
    ["code-swarm:product-planner", "code-swarm:issue-groomer", "code-swarm:issue-groomer", "code-swarm:issue-groomer"])
  assert.match(calls[0].prompt, /todo list with tags/)
  assert.equal(calls[0].isolation, "worktree")
  assert.match(calls[1].prompt, /depends_on issues: none/)
  assert.match(calls[3].prompt, /depends_on issues: 101\./)     // feature 2 unfiled → not cited
  assert.equal(result.build, true)
  assert.equal(result.spec_path, plan.spec_path)
  assert.equal(result.pr_url, plan.pr_url)
  assert.deepEqual(result.issues, [{ number: 101, title: "f1", feature: 1 }, { number: 103, title: "f3", feature: 3 }])
  assert.deepEqual(result.unfiled, [{ feature: 2, title: "tags", anchor: "docs/specs/2026-09-24-todo.md#feature-2" }])
  assert.ok(!calls.some(c => c.agentType === "code-swarm:issue-filer"))
}

// --build: planner returns nothing → abort, no issues filed
{
  const { calls, result } = await run({ build: "x", config }, type => type === "product-planner" ? null : undefined)
  assert.equal(calls.length, 1)
  assert.equal(result.build, true)
  assert.match(result.error, /planner returned no spec/)
}

// --build: planner aborts on purpose (e.g. slug exists) → its reason reaches the result
{
  const why = { title: "slug exists", body: "docs/specs/2026-01-01-x.md", kind: "debt", source: "build" }
  const { calls, result } = await run({ build: "x", config },
    type => type === "product-planner" ? { spec_path: "", pr_url: "", features: [], findings: [why] } : undefined)
  assert.equal(calls.length, 1)
  assert.match(result.error, /planner returned no spec/)
  assert.deepEqual(result.findings, [why])
}

// app block → every prompt tells the verifier how to start the app; absent → lens explicitly off
{
  const withApp = { ...config, app: { start_cmd: "npm run dev", url: "http://localhost:5173" } }
  const { calls } = await run({ issues: [9], dryRun: true, config: withApp })
  assert.match(calls[0].prompt, /App: start with "npm run dev", url http:\/\/localhost:5173, wait 10s before testing\./)
  const { calls: plain } = await run({ issues: [9], dryRun: true, config })
  assert.match(plain[0].prompt, /No app block; skip the live-app lens\./)
}

// jev config -> CONV line in every prompt
{
  const { calls } = await run({ issues: [9], dryRun: true, config: { ...config, jev: { mode: "shadow", cli: "/p/jev.py" } } })
  assert.ok(calls.length > 0)
  for (const c of calls) assert.match(c.prompt, /Jev gates: mode shadow; CLI \/p\/jev\.py; run it as JEV_REPO=dayos python3 \/p\/jev\.py /)
}

// no jev block or mode off -> "Jev gates off."
{
  const { calls: noJev } = await run({ issues: [9], dryRun: true, config })
  assert.match(noJev[0].prompt, /Jev gates off\./)
  const { calls: offJev } = await run({ issues: [9], dryRun: true, config: { ...config, jev: { mode: "off", cli: "/p/jev.py" } } })
  assert.match(offJev[0].prompt, /Jev gates off\./)
}

// agents carry exactly one Jev gate section naming battery + spec thresholds
{
  const checks = {
    "pr-verifier": [/verifier_leniency/, /0\.7/, /CONFIG's Jev command/],
    "issue-filer": [/finding_dedup/, /0\.8/, /0\.2/, /possible-dup: #/, /CONFIG's Jev command/],
    "product-planner": [/feature_sizing/, /0\.4/, /0\.7/, /CONFIG's Jev command/],
  }
  for (const [name, patterns] of Object.entries(checks)) {
    const md = readFileSync(new URL(`../agents/${name}.md`, import.meta.url), "utf8")
    assert.equal((md.match(/^## Jev gate/gm) ?? []).length, 1, `${name}: exactly one Jev gate section`)
    assert.match(md, /Jev gates off\./, `${name}: mentions Jev gates off`)
    for (const p of patterns) assert.match(md, p, `${name}: matches ${p}`)
    assert.doesNotMatch(md, /python3 <CLI>/, `${name}: no hand-spelled Jev command`)
  }
}

// issue-filer renders findings into the four issue-ready sections
{
  const md = readFileSync(new URL("../agents/issue-filer.md", import.meta.url), "utf8")
  for (const p of [/### Files/, /### Change/, /### Test/, /### Acceptance/, /--state all/, /not_filed/, /wording-only/]) {
    assert.match(md, p)
  }
  assert.doesNotMatch(md, /needs human input/)
}

// findings carry issue-ready fields
{
  const src = readFileSync(new URL("../skills/swarm/swarm.js", import.meta.url), "utf8")
  assert.match(src, /required: \["title", "body", "kind", "source", "files", "change", "test"\]/)
  assert.match(src, /not_filed/)
}

// every finding producer asks for change
{
  for (const name of ["docs-syncer", "feature-architect", "issue-implementer", "issue-triager", "pr-verifier", "product-planner", "roadmap-syncer", "security-auditor", "test-gap-auditor"]) {
    const md = readFileSync(new URL(`../agents/${name}.md`, import.meta.url), "utf8")
    assert.match(md, /"change"/, name)
  }
}

// issues accept {n, tier}; implementer model from tier
{
  const { calls } = await run({ issues: [{ n: 5, tier: "opus" }, 6], config }, (type, prompt) => {
    if (type === "issue-triager") {
      const n = Number(prompt.match(/#(\d+)/)[1])
      return { needs_human: false, reason: "", findings: [],
        brief: { issue: n, branch: `b${n}`, commit_subject: "s", files: [`f${n}.py`], steps: [], tests: [], targeted_pytest: "t", risk: "low", lang: "python" } }
    }
    if (type === "issue-implementer") return { status: "pr_open", pr_url: "u", pr_number: 1, branch: "b", findings: [] }
    if (type === "pr-verifier") return { verdict: "approve", reasons: [], findings: [] }
  })
  assert.ok(calls.some(c => /Triage issue #5/.test(c.prompt)))
  assert.ok(calls.some(c => /Triage issue #6/.test(c.prompt)))
  assert.equal(calls.find(c => c.label === "impl:#5").model, "opus")
  assert.equal(calls.find(c => c.label === "impl:#6").model, "sonnet")
}

console.log("OK")
