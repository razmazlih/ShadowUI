# ShadowUI · RABEN

**When the work changes, the interaction should change with it.** ShadowUI is an adaptive software prototype: express an objective, work inside a composed interface, change the situation, compare solutions, and confirm a verifiable result.

The primary use case is repairing a small team's weekly shift plan after availability changes. It demonstrates a narrower hypothesis than “AI builds any app”: observable work state can determine when a calendar should give way to a decision surface and then a confirmation surface. This is a product hypothesis, not a proven competitive advantage.

## Run

Node.js 20.9+ and installed Google Chrome for browser tests.

```sh
npm ci
npm run dev
```

Open [ShadowUI](http://localhost:3000). **Local demo** needs no API key. It uses clearly labeled example data and limited deterministic intent rules. For direct OpenAI planning, configure server-only `OPENAI_API_KEY`, restart and select **Live AI**. Live AI temporarily uses `gpt-6.1-sol` through 2026-10-19 22:08:30 Asia/Jerusalem, then automatically returns to `gpt-4.1-mini`. Production also needs shared durable budget storage: `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`, or `AI_STATE_DIR` on a persistent shared volume. Without durable storage production Live AI fails closed; a serverless `/tmp` directory is not sufficient. See [AI operations](docs/ai-operations.md) for setup, costs and safety limits. Demo remains available without credentials.

```sh
npm run typecheck
npm test
npm run build
npm start
# With an app server running in another terminal:
npm run test:e2e
node scripts/capture-mcp-evidence.mjs
```

Do not run `next dev` and `next build` concurrently against the same `.next` directory. The test suite uses Chrome in reduced-motion mode; normal browser operation retains subtle transitions.

## Known-good hero path

1. Choose **Build a conflict-free week**, or type “Organize next week's shifts for six employees, including Daniel.” The roster is an editable October 19–23, 2026 fixture.
2. In availability controls, choose Daniel and **2026-10-21**, then **Mark unavailable**. The server detects Daniel's conflicting assignment. The interface automatically focuses on eligible replacement comparisons; no AI call or extra “build a conflict UI” instruction is needed.
3. Select a replacement. A preview shows the before/after assignment and constraint outcome without modifying authoritative data. Reject it or **Apply proposal**.
4. Choose **Review & confirm**, then **Confirm internal schedule**. The MCP tool validates all constraints again, writes the committed revision, and returns a persisted receipt. This is a real internal server action, not an employer-system update.
5. Refresh, visit another workspace and return. The same receipt is retrieved. **Undo** restores the preceding draft through another actual server operation.

The prompt also supports the explicit constraint “Daniel cannot work Wednesday and everyone needs two days off.” Ambiguous or unsupported schedule commands request a supported control/clarification instead of claiming execution.

## Hosted demonstration

On non-loopback browser hosts, scheduling runs as a browser-local demo using the same deterministic constraints. Schedule history, revisions and demo confirmation records are saved in localStorage for that browser and origin. They are not backend receipts, are not shared across devices, and disappear when browser data is cleared. Cross-tab writes are not transactionally coordinated. Hosted scheduling does not invoke MCP; the real loopback MCP path remains available when running locally. Live AI requires separately configured server credentials and has not been enabled by deployment alone.

## Architecture and persistence

```mermaid
flowchart LR
  I[Intent] --> P[Server UI planner: demo rules or configured LLM]
  P --> Z[Bounded Zod UI specification]
  Z --> R[Trusted React component grammar]
  R --> B[Browser workspace memory: layout, notes, study progress]
  R --> C[Real MCP web client]
  C --> M[Loopback Streamable HTTP MCP server]
  M --> D[Independent scheduling domain state]
  D --> E[Deterministic constraints and alternatives]
  E --> A[Adaptation policy: plan / resolve / review / outcome]
  A --> R
  M --> S[Atomic local file persistence + revision history]
  S --> K[Validated commit + recoverable receipt]
  K --> R
```

`lib/schema.ts`, `lib/planner.ts`, and `lib/patch.ts` retain the original compositional engine and stable IDs. Thirteen trusted primitives support checklist, timeline, calendar, kanban, flashcards, quiz, slider, editable table, weighted comparison, notes, timer, approval, and chart. Independent capability rules can combine these for unfamiliar goals. The model produces JSON, never executable application code.

`lib/schedule.ts` contains the separate domain model, interval-overlap checks, unavailable-date checks, uncovered-shift checks, per-week days-off enforcement and candidate evaluation. `lib/adaptation.ts` selects interaction modes from actual facts and records the objective, trigger, reason, preserved state and allowed actions. Clear conditions run deterministically; configured AI is reserved for semantic interface planning, not ordinary clicks.

`lib/schedule-store.ts` serializes writes in one Node process, validates state and atomically renames local files under `.shadowui/` (ignored by Git). Revisions reject stale writers; action IDs make retries idempotent; confirmed commits produce receipts; undo consumes real history. Storage failures remain errors. `SHADOWUI_DATA_DIR` can select another local directory. This requires a writable persistent filesystem; it is not a multi-process database or an ephemeral-serverless deployment solution.

Browser workspace memory and server scheduling records are separate. Refreshing or switching layouts does not recreate domain data. Clearing browser storage removes navigation references; backend files are not deleted. Workspace JSON export contains the layout/domain reference, not a backup of server history. Running focus countdowns reset on remount, while duration and meaningful task edits persist.

## Real MCP capabilities

[Web test host](http://localhost:3000/mcp-host) is explicitly a **simulated Alexa+ host**. The main scheduling UI is also a real MCP client: initialize → initialized notification → tools/list → tools/call. The endpoint implements JSON-response Streamable HTTP, supported protocol revisions **2025-11-25** and **2025-03-26**, and GET 405 because server-initiated SSE is absent.

| Tool | Real effect |
|---|---|
| `compose_workspace` | Returns a validated demo proposal; no implicit save |
| `validate_workspace` | Checks the bounded component grammar |
| `create_schedule` | Creates or retrieves the server-local draft |
| `inspect_schedule` | Reads authoritative state, constraints and eligible alternatives |
| `preview_schedule_change` | Computes a candidate without writing |
| `update_schedule` | Applies explicit operations or undo with revision/idempotency guards |
| `commit_schedule` | Requires literal confirmation and a valid schedule; persists a receipt |

Mutating calls carry `expectedRevision` and `actionId`. Previews carry a revision; confirmation must be `true`. Tool failures carry `isError` and a machine error code. The UI shows pending, failure, retry and success states. A retry reuses its original action ID. A superseded action is rejected rather than presenting an outdated receipt as current.

This unauthenticated demo accepts **loopback hosts only** and rejects cross-origin requests. It is a genuine locally self-hosted MCP flow, **not** a public Alexa+ service. Remote judging access requires an explicitly prepared hosted demonstration or authorized secure deployment. No physical Alexa+ execution, account connection or certification is claimed. [Protocol reference](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports).

## Evidence and evaluation

- [Verified implementation and boundaries](docs/verification.md): 32 logic tests, 12 browser checks and production build passed.
- [Recorded actual HTTP MCP exchanges](docs/evidence/mcp-flow.json): discovery, blocked invalid commit, nonmutating preview, applied repair, confirmed receipt, duplicate-action replay and reinspection. All roster data is synthetic.
- `tests/evaluation.test.ts`: five cases exercise the hero, tighter constraints, another domain, unfamiliar capability composition and unsupported external execution. These are deterministic/store-level assertions, not proof of universal intelligence or paid-provider quality.
- `tests/e2e/hero.spec.ts`: repeats the principal workflow three times; checks failure/retry, refresh, cross-workspace continuity and undo through actual HTTP tools.
- `tests/e2e/reliability.spec.ts`: invalid model output, unsupported execution, stale sessions, mobile and RTL.
- `tests/e2e/workspace.spec.ts`: preserves the original study, budget, comparison and unfamiliar-goal paths.

## Boundaries

The hero intentionally supports the named six-person fixture; a different requested roster size returns an explicit unsupported-constraint error. Dates and slots are fixture data. Employee availability, assignments and minimum days off are editable; dynamic hiring, payroll, qualifications, labor-law compliance and external scheduling integrations are absent. Alternative scores favor lower assigned hours; they are deterministic heuristics, not predictions or a full staffing optimizer. Impossible constraints remain blocked.

The grammar is reusable, but the hero's domain binding and constraints are implemented specifically. Arbitrary unfamiliar workflows can receive local planning controls; they do not gain unimplemented external actions. Nonbiology demo learning asks for user-provided source material. Travel costs and decision scores are editable estimates. Hebrew intent signals and RTL layout work; the full demo shell is English. AI semantic planning, full localization, public hosting, physical Alexa+, user research and measured time savings remain separate unverified work.

## Submission preparation

- [2:50 demonstration script](docs/demo-guide.md)
- [Skeptical product/judging assessment](docs/strategy.md)
- [Pre-submission checklist](docs/submission-checklist.md)

Internal target: **October 21 evening, Jerusalem time**. Official rules checked October 18 state **October 23, 2026, noon PDT (22:00 Jerusalem)**; recheck before submitting. No submission, judging access, eligibility or competitive outcome is claimed. [Official rules](https://amazonappdev2026.devpost.com/rules).

### Goal-specific custom tools

Live AI can now create a `custom` tool when the built-in tools do not fit the requested action. It composes named number, text, select and toggle fields with validated local calculations, three layouts (form, metrics, steps), and four accents. The planner avoids default filler cards and explains each tool's purpose. Generation uses the existing single AI request and budget guard.

Custom definitions are declarative data, not executable code. Calculations support bounded RPN arithmetic (+, -, *, /, min, max); division by zero and non-finite results show errors. Stable field values survive AI adaptations when compatible with new bounds/options. Browser persistence and JSON export include the definition and values. This supports local forms and scenario calculators; arbitrary apps, new network integrations, and external actions require implementation. Demo mode retains its existing deterministic tools.
