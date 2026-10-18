# Verified implementation · October 18, 2026

This record describes this local checkout, not a published submission or an Alexa+ device integration.

| Layer | Command / evidence | Observed result |
|---|---|---|
| Production build and TypeScript | `npm run build` | Passed without compiler warnings |
| Logic and protocol/store tests | `npm test` | 32 passed, 0 failed; includes the five-case evaluation |
| Browser → HTTP → MCP → persistence → UI | `npm run test:e2e` against the production server | 12 passed, 0 failed, 15.0 seconds for the entire suite |
| Repeated primary flow | Three independent fresh-browser hero cases | Conflict, nonmutating preview, reject/apply, confirmed receipt, reload, another workspace, return and undo all passed |
| Failure boundaries | Browser reliability cases | Invalid model component rejected; unsupported external action labeled; stale writer refreshed; interrupted commit did not create a false receipt and same-action retry succeeded |
| Responsive behavior | 390×844 viewport and RTL case | Conflict resolution reachable and no document overflow |
| Actual tool traffic | `node scripts/capture-mcp-evidence.mjs` | Twelve real loopback HTTP exchanges; [raw evidence](evidence/mcp-flow.json) |
| Process restart | Stop development server, build, start production server, then `node scripts/verify-recovery.mjs` | Original committed receipt recovered from the same local storage directory; [raw evidence](evidence/recovery.json) |

The browser suite uses installed Chrome with reduced motion for repeatable checks. Early integration runs found and fixed local host normalization, selector scoping, a command that skipped one of two constraints, invalid-spec feedback and off-screen adaptation focus. Tests establish these paths, not a guarantee of reliability for arbitrary input.

## Working

- Original schema-driven primitive composition and component/item identity.
- Independent server-side scheduling state, surviving UI changes and process restart.
- Availability, interval overlap, coverage and weekly days-off calculations.
- Planning → resolution → review → outcome selected from actual state, with explicit reasons.
- Candidate evaluation, nonmutating preview, rejection, applied changes and explicit confirmation.
- Durable server commit receipts, revision validation, idempotent retries, superseded-action rejection and undo history.
- Main UI uses actual MCP initialize/discovery/invocation; visible tool evidence distinguishes success and failure.
- Study progress and quiz answers survive constraint patches and refresh; generic unfamiliar tasks compose bounded interactive primitives.

## Simulated or bounded

- The six-employee roster, dates and shift slots are explicit fixtures.
- Alexa+ host behavior is simulated by a web client. No physical Alexa device is involved.
- Commits write to ShadowUI's local server only. They do not publish an employer roster.
- The demo planner uses independent rules. It does not establish open-ended natural-language competence.
- Candidate load scores are deterministic heuristics, not measured probabilities or global optimization.

## Not verified / unsupported

- Paid live model quality, device execution, remote Alexa access, Amazon certification, external integrations.
- Public judge access, deployment persistence, multi-process concurrency and production authentication.
- Arbitrary roster size, regulatory compliance, payroll, travel booking, payments and arbitrary code generation.
- Full Hebrew localization, comprehensive keyboard/screen-reader audit and novice-user comprehension in 20 seconds.
- Customer adoption, measured time savings, superiority over app builders, eligibility or a predicted competition result.

## Visual evidence

[Conflict-driven interaction](evidence/adaptive-resolution.png) · [Committed outcome](evidence/committed-outcome.png) · [Desktop](desktop-preview.png) · [Mobile](mobile-preview.png)

All screenshots use a separate clean browser context and synthetic data. Existing browser workspaces were retained.
