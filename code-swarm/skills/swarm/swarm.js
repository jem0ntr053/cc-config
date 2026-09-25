export const meta = {
  name: "code-swarm",
  description: "Turn agent-ready issues into verified PRs; --audit files security/test-gap findings",
  phases: [
    { title: "Plan", detail: "product-planner writes docs/specs/<slug>.md" },
    { title: "Design", detail: "feature-architect posts designs on `feature` issues" },
    { title: "Triage", detail: "issue-triager builds briefs" },
    { title: "Implement", detail: "issue-implementer opens PRs (worktrees)" },
    { title: "Verify", detail: "pr-verifier reviews, one fix round" },
    { title: "Audit", detail: "security-auditor + test-gap-auditor" },
    { title: "Docs", detail: "roadmap-syncer + docs-syncer open docs PRs" },
    { title: "File", detail: "issue-filer dedupes and files findings" },
  ],
}

const {
  issues = [], features = [], dryRun = false, audit = false, docs = false, build = "", date = "unknown",
  config = {},
} = args ?? {}
const REPO = config.root ?? "."
const CONV_DOC = config.conventions ?? ""          // e.g. ".claude/skills/<repo>-conventions/SKILL.md" or ""
const TEST_CMD = config.test_cmd ?? "pytest -q"
const MAIN = config.main_branch ?? "main"
const SCA_CMD = config.sca_cmd ?? ""               // e.g. "bandit -q -r ."
const LANGS = config.langs ?? ["python"]

// ── Schemas ───────────────────────────────────────────────────────────────────

const FINDING = {
  type: "object",
  properties: {
    title: { type: "string" },
    body: { type: "string" },
    kind: { type: "string", enum: ["bug", "feature", "debt", "security", "test-gap"] },
    source: { type: "string" },
  },
  required: ["title", "body", "kind", "source"],
}
const FINDINGS = { type: "array", items: FINDING }

const BRIEF_SCHEMA = {
  type: "object",
  properties: {
    needs_human: { type: "boolean" },
    reason: { type: "string" },
    brief: {
      type: "object",
      properties: {
        issue: { type: "integer" },
        title: { type: "string" },
        branch: { type: "string" },
        commit_subject: { type: "string" },
        files: { type: "array", items: { type: "string" } },
        steps: { type: "array", items: { type: "string" } },
        tests: {
          type: "array",
          items: {
            type: "object",
            properties: { file: { type: "string" }, name: { type: "string" }, asserts: { type: "string" } },
            required: ["file", "name", "asserts"],
          },
        },
        targeted_pytest: { type: "string" },
        risk: { type: "string", enum: ["low", "medium", "high"] },
        lang: { type: "string" },
      },
      required: ["issue", "branch", "commit_subject", "files", "steps", "tests", "targeted_pytest", "risk", "lang"],
    },
    findings: FINDINGS,
  },
  required: ["needs_human", "reason", "findings"],
}

const IMPL_SCHEMA = {
  type: "object",
  properties: {
    status: { type: "string", enum: ["pr_open", "failed"] },
    pr_url: { type: "string" },
    pr_number: { type: "integer" },
    branch: { type: "string" },
    tests: { type: "object", properties: { passed: { type: "integer" }, failed: { type: "integer" } } },
    error: { type: "string" },
    findings: FINDINGS,
  },
  required: ["status", "branch", "findings"],
}

const VERDICT_SCHEMA = {
  type: "object",
  properties: {
    verdict: { type: "string", enum: ["approve", "changes_requested"] },
    reasons: { type: "array", items: { type: "string" } },
    tests: { type: "object", properties: { passed: { type: "integer" }, failed: { type: "integer" } } },
    findings: FINDINGS,
  },
  required: ["verdict", "reasons", "findings"],
}

const DESIGN_SCHEMA = {
  type: "object",
  properties: {
    skip: { type: "boolean" },
    approach: { type: "string" },
    files: { type: "array", items: { type: "string" } },
    steps: { type: "array", items: { type: "string" } },
    tests: { type: "array", items: { type: "object" } },
    risks: { type: "array", items: { type: "string" } },
    open_questions: { type: "array", items: { type: "string" } },
    findings: FINDINGS,
  },
  required: ["skip", "approach", "findings"],
}

const AUDIT_SCHEMA = { type: "object", properties: { findings: FINDINGS }, required: ["findings"] }

const DOCS_SCHEMA = {
  type: "object",
  properties: {
    status: { type: "string", enum: ["pr_open", "unchanged", "failed"] },
    pr_url: { type: "string" },
    branch: { type: "string" },
    changes: { type: "array", items: { type: "string" } },
    error: { type: "string" },
    findings: FINDINGS,
  },
  required: ["status", "changes", "findings"],
}

const FILER_SCHEMA = {
  type: "object",
  properties: {
    created: { type: "array", items: { type: "object", properties: { number: { type: "integer" }, title: { type: "string" } } } },
    skipped_duplicate: { type: "array", items: { type: "object", properties: { title: { type: "string" }, dup_of: { type: "string" } } } },
  },
  required: ["created", "skipped_duplicate"],
}

const PLAN_SCHEMA = {
  type: "object",
  properties: {
    spec_path: { type: "string" },
    pr_url: { type: "string" },
    features: {
      type: "array",
      items: {
        type: "object",
        properties: { n: { type: "integer" }, title: { type: "string" }, depends_on: { type: "array", items: { type: "integer" } } },
        required: ["n", "title", "depends_on"],
      },
    },
    findings: FINDINGS,
  },
  required: ["spec_path", "pr_url", "features", "findings"],
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// GROUP-BEGIN
// Union briefs that share any file; returns array of groups (each an array of briefs).
// ponytail: O(n²) pairwise scan, fine for <50 briefs/run.
function groupByFiles(briefs) {
  const groups = []
  for (const b of briefs) {
    const hits = groups.filter(g => g.some(o => o.files.some(f => b.files.includes(f))))
    if (hits.length === 0) { groups.push([b]); continue }
    const merged = [...hits.flat(), b]
    for (const h of hits) groups.splice(groups.indexOf(h), 1)
    groups.push(merged)
  }
  return groups
}
// GROUP-END

const CONV = [
  `Repo root: ${REPO}. Main branch: ${MAIN}.`,
  `Test command: ${TEST_CMD}.`,
  SCA_CMD ? `Security scan command: ${SCA_CMD}.` : `No security scan command configured; skip SCA, note it.`,
  `Languages: ${LANGS.join(", ")}.`,
  CONV_DOC ? `Read ${CONV_DOC} before anything else.` : `No repo conventions doc; follow standard git flow.`,
].join("\n")
const findings = []
const collect = r => { if (r && Array.isArray(r.findings)) findings.push(...r.findings) }
let results = []
let designCount = 0
let docsResults = []

// ── Build mode ────────────────────────────────────────────────────────────────

if (build) {
  phase("Plan")
  const plan = await agent(`${CONV}\nToday is ${date}. PROMPT:\n${build}\nWrite the product spec per your instructions, open the spec PR, and return the plan JSON.`,
    { label: "plan:spec", phase: "Plan", agentType: "code-swarm:product-planner", schema: PLAN_SCHEMA, effort: "high", isolation: "worktree" })
  collect(plan)   // before the guard: a deliberate abort explains itself in findings
  if (!plan || !plan.spec_path) return { build: true, error: "planner returned no spec", prompt: build, findings }
  phase("File")
  const issueOf = {}   // feature n → issue number
  const issues = [], unfiled = []
  // ponytail: sequential filing so depends_on can cite real issue numbers; two-pass (create, then edit bodies) if a spec ever has >30 features.
  for (const f of plan.features) {
    const deps = (f.depends_on ?? []).map(d => issueOf[d]).filter(Boolean)
    const r = await agent(`${CONV}\nBUILD MODE. spec_path: ${plan.spec_path}. feature: ${f.n} (${f.title}). depends_on issues: ${deps.join(", ") || "none"}. File it per your instructions.`,
      { label: `file:f${f.n}`, phase: "File", agentType: "code-swarm:issue-groomer", schema: FILER_SCHEMA, effort: "medium" })
    const c = r?.created?.[0]
    if (c) { issueOf[f.n] = c.number; issues.push({ ...c, feature: f.n }) }
    else unfiled.push({ feature: f.n, title: f.title, anchor: `${plan.spec_path}#feature-${f.n}` })
  }
  return { build: true, spec_path: plan.spec_path, pr_url: plan.pr_url ?? "", issues, unfiled, findings }
}

// ── Audit mode ────────────────────────────────────────────────────────────────

if (audit) {
  phase("Audit")
  const [sec, gaps] = await parallel([
    () => agent(`${CONV}\nRun the full security audit described in your instructions and return findings.`,
      { label: "audit:security", phase: "Audit", agentType: "code-swarm:security-auditor", schema: AUDIT_SCHEMA, effort: "medium" }),
    () => agent(`${CONV}\nRun the full test-gap audit described in your instructions and return findings.`,
      { label: "audit:test-gaps", phase: "Audit", agentType: "code-swarm:test-gap-auditor", schema: AUDIT_SCHEMA, effort: "medium" }),
  ])
  collect(sec); collect(gaps)
  log(`audit: ${findings.length} findings`)
} else if (docs) {

// ── Docs mode ─────────────────────────────────────────────────────────────────

  phase("Docs")
  const [roadmap, readme] = await parallel([
    () => agent(`${CONV}\nToday is ${date}. Run the roadmap sync described in your instructions and return the result.`,
      { label: "docs:roadmap", phase: "Docs", agentType: "code-swarm:roadmap-syncer", schema: DOCS_SCHEMA, effort: "medium", isolation: "worktree" }),
    () => agent(`${CONV}\nToday is ${date}. Run the docs sync described in your instructions and return the result.`,
      { label: "docs:readme", phase: "Docs", agentType: "code-swarm:docs-syncer", schema: DOCS_SCHEMA, effort: "medium", isolation: "worktree" }),
  ])
  collect(roadmap); collect(readme)
  docsResults = [{ agent: "roadmap-syncer", ...(roadmap ?? { status: "failed", error: "returned null", changes: [] }) },
                 { agent: "docs-syncer", ...(readme ?? { status: "failed", error: "returned null", changes: [] }) }]
  log(`docs: ${docsResults.map(d => `${d.agent}=${d.status}`).join(", ")}`)
} else {

// ── Design (features) ∥ Queue (issues) ────────────────────────────────────────

  // dry-run is read-only: design posts comments + labels, so it waits for a real run
  const designRun = pipeline(dryRun ? [] : features, n =>
    agent(`${CONV}\nDesign feature issue #${n}. Follow your instructions: rung-1 check, trace the flow, post the design comment, label design-review.`,
      { label: `design:#${n}`, phase: "Design", agentType: "code-swarm:feature-architect", schema: DESIGN_SCHEMA, effort: "high" }))

  phase("Triage")
  const triageAct = dryRun
    ? "DRY RUN: read-only. If it is not agent-ready, set needs_human with the reason; do NOT comment, relabel, or run any gh write."
    : "If it is not agent-ready, set needs_human, comment, and relabel."
  const triaged = (await parallel(issues.map(n => () =>
    agent(`${CONV}\nTriage issue #${n} into a brief per your instructions. ${triageAct}`,
      { label: `triage:#${n}`, phase: "Triage", agentType: "code-swarm:issue-triager", schema: BRIEF_SCHEMA, effort: "high" })
      .then(r => ({ issue: n, r }))
  ))).filter(Boolean)

  triaged.forEach(({ r }) => collect(r))
  const briefs = triaged.filter(({ r }) => r && !r.needs_human && r.brief).map(({ r }) => r.brief)
  const rejected = triaged.filter(({ r }) => !r || r.needs_human).map(({ issue, r }) => ({ issue, reason: r ? r.reason : "triager returned null" }))
  log(`triage: ${briefs.length} briefs, ${rejected.length} needs-human`)

  if (dryRun) {
    await designRun
    return { dryRun: true, briefs, rejected, findings }
  }

  // ── Implement → Verify (grouped) ────────────────────────────────────────────

  async function runBrief(brief) {
    const n = brief.issue
    const briefJson = JSON.stringify(brief, null, 2)
    const impl = await agent(`${CONV}\nIMPLEMENTATION BRIEF:\n${briefJson}\nFollow your instructions. First run: create the branch, open the PR, label pr-open.`,
      { label: `impl:#${n}`, phase: "Implement", agentType: "code-swarm:issue-implementer", schema: IMPL_SCHEMA, effort: "medium", isolation: "worktree" })
    collect(impl)
    if (!impl || impl.status !== "pr_open" || !impl.pr_number) {
      return { issue: n, status: "needs_human", error: impl ? (impl.error || "implementer returned no pr_number") : "implementer returned null", branch: impl?.branch ?? brief.branch }
    }
    let verdict = null
    for (let round = 1; round <= 2; round++) {
      verdict = await agent(`${CONV}\nVerify PR #${impl.pr_number} on branch ${impl.branch} for issue #${n}, round ${round} of 2.\nBRIEF:\n${briefJson}\nFollow your instructions; post the verdict comment; on round 2 changes_requested label needs-human.`,
        { label: `verify:#${n}:r${round}`, phase: "Verify", agentType: "code-swarm:pr-verifier", schema: VERDICT_SCHEMA, effort: "medium", isolation: "worktree" })
      collect(verdict)
      if (!verdict || verdict.verdict === "approve") break
      if (round === 1) {
        const fix = await agent(`${CONV}\nFIX ROUND for issue #${n} on existing branch ${impl.branch} (PR #${impl.pr_number}). Check out the branch, apply these verifier reasons, run tests, push. Do not open a new PR.\nREASONS:\n- ${verdict.reasons.join("\n- ")}\nBRIEF:\n${briefJson}`,
          { label: `fix:#${n}`, phase: "Implement", agentType: "code-swarm:issue-implementer", schema: IMPL_SCHEMA, effort: "medium", isolation: "worktree" })
        collect(fix)
        if (!fix || fix.status !== "pr_open") return { issue: n, status: "needs_human", pr_url: impl.pr_url, error: fix ? fix.error : "fix round returned null" }
      }
    }
    const ok = verdict && verdict.verdict === "approve"
    return { issue: n, status: ok ? "pr_open" : "needs_human", pr_url: impl.pr_url, branch: impl.branch, tests: verdict?.tests ?? impl.tests, reasons: verdict?.reasons ?? [] }
  }

  const groups = groupByFiles(briefs)
  log(`implement: ${groups.length} independent group(s) from ${briefs.length} brief(s)`)
  const groupResults = await parallel(groups.map(g => async () => {
    const out = []
    for (const b of g) out.push(await runBrief(b))   // overlapping files → sequential
    return out
  }))
  groupResults.filter(Boolean).forEach(arr => results.push(...arr))

  const designs = (await designRun).filter(Boolean)
  designs.forEach(collect)
  results.push(...rejected.map(r => ({ ...r, status: "needs_human" })))
  designCount = designs.length
}

// ── File findings ─────────────────────────────────────────────────────────────

phase("File")
let filed = { created: [], skipped_duplicate: [] }
if (findings.length > 0) {
  const f = await agent(`${CONV}\nToday is ${date}. File these findings per your instructions:\n${JSON.stringify(findings, null, 2)}`,
    { label: "file:findings", phase: "File", agentType: "code-swarm:issue-filer", schema: FILER_SCHEMA, effort: "low" })
  filed = f ?? { created: [], skipped_duplicate: [], error: "filer returned null; findings listed below" }
}

return audit
  ? { audit: true, findings, filed }
  : docs
  ? { docs: docsResults, findings, filed }
  : { results, designs: designCount, findings, filed }
