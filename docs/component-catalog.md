# Task-aware component catalog

ShadowUI now has a separate task contract, persistent component catalog and deterministic composition pipeline. The existing `/api/plan` response includes `contract`, `selections`, `coverage` and `validation`; workspaces persist `taskContract`, `taskReport`, typed `bindings`, pinned `catalogRef` values and `editedPaths`.

## Runtime

1. A server AI call distinguishes conversation, task changes, questions, clarification and scheduling proposals. Task changes produce a validated task DAG, required capabilities, supplied/missing inputs and success criteria.
2. Firestore supplies active shared definitions plus this session's private definitions. Capability and input-schema compatibility are mandatory. Batched multilingual embeddings rank eligible definitions; shared definition vectors persist by version/content hash, query vectors remain session scoped in the short-lived budget ledger.
3. Deterministic set cover selects a small complementary set. A second AI call populates only selected trusted renderers from supplied facts. A missing calculation or collection action can produce a new bounded RPN calculator or named-input form.
4. Definitions, instances, action coverage, data edges and resolved behavior are checked. At most one focused repair is allowed across schema/behavior failures. Network failures are not retried automatically.
5. New generated tools are private draft revision 1 and become active revision 2 only after validation. Their reusable default inputs come from bounded neutral probes, not private user values. Existing definitions and immutable pinned versions are reused.
6. React renders the trusted primitives. Input edits, calculations and copy/project/sum/count bindings run deterministically without AI. Browser persistence keeps instance data separately from Firestore definitions.

## Configuration

Use `.env.example`. Cloud Firestore uses `FIREBASE_PROJECT_ID` plus `FIREBASE_SERVICE_ACCOUNT_JSON` (hosted server secret) or Application Default Credentials. `FIREBASE_ADMIN_EMAIL` restricts verified Google identities; client Firebase configuration only uses public web-app values. The dedicated cloud project is `shadowui-razmaz`, database `(default)`, Standard, `eur3`, free tier with deletion protection. No billing account was attached.

`firebase deploy --only firestore:rules,auth --project shadowui-razmaz` deploys deny-direct-client database rules and Google provider configuration. The server identity needs `roles/datastore.user` and `roles/firebaseauth.viewer` only within this project. Never commit service-account files, `.env.local` or `.shadowui`.

Add local/Preview hostnames to Firebase Authentication's authorized domains. Google sign-in itself is interactive and must be verified with the administrator's real browser session; an emulator identity is not proof of a live Google login.

## Catalog administration

`/catalog` offers public active browsing, search/categories/status filters, interactive isolated preview, JSON definition editing, validation findings, immutable revision history, activation, retirement and rollback. Google login plus server allowlist verification protects writes. Shared definitions require explicit synthetic-data confirmation. Ownership/scope is immutable; publishing a private tool means creating a new sanitized shared definition, not exposing its private history.

A component's support flags are claims, not a full accessibility certification. Seed definitions report accessibility as unverified. Runtime controls have labels and keyboard paths; mobile/RTL and specific interactions are tested separately.

## Verification commands

```sh
npm run typecheck
npm test
npm run test:catalog  # isolated Auth + Firestore emulators under demo-shadowui-catalog
SHADOWUI_DIST_DIR=.next-catalog npm run build
SHADOWUI_DIST_DIR=.next-catalog npx next start --hostname 127.0.0.1 --port 3100
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3100 npx playwright test tests/e2e/catalog.spec.ts tests/e2e/task-contract.spec.ts
npm run verify:task-live  # real provider/database; requires keys and existing AI budget
```

Use `OPENAI_API_KEY=''` on the local server when running mocked browser tests to prevent accidental paid calls. `SHADOWUI_DIST_DIR` permits an isolated build alongside existing dev servers.

## Limits

- Generation currently adds bounded local calculators and input forms. Existing primitives cover other local editing tasks; arbitrary generated code and unimplemented integrations remain unavailable.
- Formula syntax/finite outputs are checked; universal semantic correctness and all possible numeric inputs are not proven.
- Instance edits are retained in the browser. Verified accounts can synchronize workspace snapshots and instance state through the authenticated account API; see [account sync](account-sync.md). Catalog private-definition ownership remains session-scoped and is separate from account snapshot storage.
- AI requests retain the existing application-wide budget and session cache. Missing provider/DB configuration fails visibly; no fictional fallback catalog is returned.
- Old embedded workspace exports still load. Catalog retirement preserves immutable historical versions; incompatible changes do not silently upgrade active instances.
- The legacy API demo classifier remains explicitly limited and deterministic; it is not a substitute for freeform live task understanding.

## Hosted acceptance evidence

The Preview is separate from production. The hosted catalog was read from Firestore and its quantity × unit-value preview returned 21 for inputs 3 and 7. A live request also exposed an invalid task-contract response; task interpretation now uses strict provider JSON-schema output, with a nullable provider adapter and one shared repair allowance across interpretation/population/behavior. Regression tests cover schema failures, references, cycles and the repair cap. See `docs/evidence/task-catalog-verification.json` for the final verification record.

### Automatic generation for catalog gaps

Missing local actions now trigger purpose-specific declarative component generation, including complementary tables, documents, boards, comparisons and forms/calculators. Generated capability aliases bind explicitly to supported renderer behavior. Schemas, input kinds, formula behavior, bindings and complete local action coverage must pass before the private definition is persisted and used. One focused repair is allowed; unsupported execution never becomes a successful editor merely by renaming it. User values remain in instances; reusable templates are sanitized. Private definitions are saved as drafts, validated, activated at a pinned revision and reused by the same session.

Verification: 147 unit tests passed (2 emulator-only skipped); all 7 emulator tests passed. A synthetic-provider inventory task also created and reused the same version-2 definition in real Firestore without any paid AI call. This check verifies cloud persistence, not live model quality for arbitrary tasks.
