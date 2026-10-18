# OpenAI integration and low-budget testing

The Next.js server calls OpenAI directly with `OPENAI_API_KEY`. No provider credential is sent to the browser, API error, or application log. The model is pinned to `gpt-4.1-mini`; there is no automatic expensive fallback. Do not configure any secret with `NEXT_PUBLIC_`.

## Production setup

1. Add `OPENAI_API_KEY` in Production Secrets.
2. For serverless or multiple instances, add `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` for the same private Redis database in every deployment. Use HTTPS, persistence, no eviction and no automatic expiration on `shadowui:ai:ledger:v1`. Redis stores sensitive workspace results briefly; restrict its access. This service may have its own costs.
3. Alternatively, set `AI_STATE_DIR` to a real persistent shared volume with exclusive-create locking and atomic rename support. Never use ephemeral serverless disk or `/tmp`. A crashed file transaction leaves `budget.lock`; investigate it before removing the lock, preserving `budget.json`.
4. Optional `AI_BUDGET_USD=4.50` (default). Allowed range: greater than zero, at most $5. This is a lifetime estimate cap, not a monthly reset. Changing keys does not reset it.
5. Redeploy/restart, select Live AI, inspect the status notice, then run one small prompt and a follow-up. Verify the provider dashboard independently.

Production blocks paid calls if durable storage is not configured or cannot be read/written. Development uses `.shadowui/ai`. Never erase or evict the ledger to reset usage. The application cannot detect an externally erased Redis database or a falsely declared persistent volume. Backups and correct deployment configuration are required.

## Connected capabilities

Live workspace creation and adaptation cover every existing renderer primitive: checklists, timelines, flashcards, quizzes, calendar, kanban, budget slider, tables, weighted comparisons, notes, timer, approval and charts. The current structured workspace is the conversation memory; previous raw chat history is not sent. Existing state is validated and merged using the original patch rules. Unrelated goals start new workspaces.

Schedule follow-ups supported by exact existing local rules remain free. Other schedule requests in Live mode send the actual schedule snapshot to OpenAI and return one validated operation or clarification. Operations are checked against real employee/shift IDs, previewed using the existing deterministic evaluator, and applied only with the existing Apply proposal button. AI does not commit a schedule. Scheduling still uses the original six-person fixture; hosted schedules remain browser-local and are clearly labeled. No employer, booking, banking, search, or external calendar service has been added.

Demo mode uses the existing local rules without paid calls. Each workspace's demo/live provenance is retained separately in browser storage. An unconfigured key produces a clear error, never a fabricated Live result. MCP compose_workspace explicitly remains a demo tool and returns mode:demo.

## Costs and limits

Assumed list prices for GPT-4.1 mini: $0.40 per million input tokens and $1.60 per million output tokens. These are configured estimates, not a fetched price feed; verify current OpenAI pricing before use. Cached-input discounts are not assumed.

| Example | Input / output tokens | Estimated cost | 100 actions |
| --- | --- | --- | --- |
| Typical generated workspace | 2,000 / 1,500 | $0.0032 | $0.32 |
| Small schedule interpretation | 1,000 / 150 | $0.00064 | $0.064 |
| Local edits, deterministic schedules, cache hit | No additional provider call | $0 | $0 |

These examples are estimates, not measured averages. Actual output length and context change the cost. Default workspace output is capped at 3,500 tokens; schedule interpretation at 450. Input is capped at a conservative 26,000 UTF-8 bytes including instructions and overhead. Large workspaces are rejected without silently discarding edits. Each paid call reserves its conservative input bound plus maximum output before contacting OpenAI; usage data reconciles the estimate afterwards. Maximum workspace reservation is about $0.016. A timeout or unknown outcome retains the reservation; there are no automatic retries.

Additional protections: atomic Redis compare-and-set or exclusive file transaction, global limit of six new reservations per minute, duplicate suppression while in flight, session-scoped ten-minute exact-result cache, HTTP-only SameSite session cookie, same-origin paid POST checks, request/body/schema limits and no provider response text in errors. The cached result is never served across session keys. Cache entries are cleaned on the next new reservation; cached results expire logically after ten minutes. The lifetime spent total is retained. This is a public demo without user authentication: global safeguards limit spending, but same-origin checks are not user access control; restrict hosting access if the test budget is private.

At 80% of the configured limit, the Live notice warns. Requests whose reservation would exceed the limit are blocked. The $4.50 default leaves $0.50 of the initial $5 as headroom. The cap applies only to this application and ledger. Provider pricing changes, other applications, erased storage and unknown billing behavior mean it is **not an absolute OpenAI billing guarantee**.

Responses are rendered only after complete JSON validation. Streaming partial workspace JSON is deliberately avoided because it cannot yet be safely applied; the existing busy indicator and explicit preview communicate progress. Provider timeout is 40 seconds; browser timeout is 55 seconds. 429, rejected key, invalid/truncated output, network failure and storage failure preserve saved work. Known uncharged 4xx failures release their reservation; usage-bearing invalid output is still accounted for. Unknown outcomes block the identical request for ten minutes; known failures allow a manual retry after 15 seconds.

## Verification

Service tests use a fake credential and mocked fetch; they incur no paid OpenAI traffic. They cover missing key, model/payload/token caps, usage settlement, session cache isolation, follow-up context, concurrent duplicate suppression, budget exhaustion, atomic file locking, rate limiting, invalid output, corrupt storage, oversized input, network failure, 429 and schedule operation validation.

Browser tests cover existing workflows and new Live UI flows with mocked AI replies, including preview/apply, provenance after reload and actual missing-key/cross-origin responses. Mocked replies test the UI boundary, not model quality. TypeScript and production build should also be checked after changes.

No OpenAI key or Redis credentials were present in the implementation environment. Paid model behavior, real Redis persistence/CAS, provider connectivity, deployment secrets, and production restart/multi-instance behavior require deployment verification. The environment's outbound policy must allow `api.openai.com` and the configured Redis host. No paid calls or load tests were made.

Implementation verification on 2026-10-18: `npm run typecheck`, `npm test` (10 test files), the 11 individual OpenAI/budget service tests, all 20 Playwright browser tests, and `npm run build` passed. Chromium used the environment's `/usr/bin/chromium` configuration; server and browser required the environment's normal execution permissions. Redis compare-and-set collision and storage failure were tested with a mock transport, not a real Redis service. No real OpenAI integration call was performed.
