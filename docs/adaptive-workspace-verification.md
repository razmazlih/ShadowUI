# Adaptive workspace verification — 2026-10-20

This phase is local and simulated. Paid model and embedding entrypoints throw before requesting a provider, reserving budget, or reading credentials. A forged Live planning request returns403. Production Firestore and production Firebase Authentication are blocked. No deployment was performed.

## Implemented paths

- Goal → deterministic simulated interpretation → task contract → catalog assembly → behavioral/schema validation → private definition persistence/reuse.
- Separate tool coverage, missing-input readiness, and explicit user-reviewed completion. Calculation errors block readiness. Source-based cards and quizzes derive from editable glossary material and invalidate stale grading.
- Local typed calculations, per-row stock allocation/shortages, weighted comparisons, connected expense chart and budget balance, document/checklist work, dated scheduling, retained edits and one-step undo (including browser restoration).
- Emulator private catalog → sanitized review queue → authenticated administrator → interactive preview/form edit/simulated proposal → explicit versioned save → separate shared approval. Private owners and pinned instances remain unchanged.
- Arbitrary numerical formula literals become synthetic parameters before review; original prompts, labels, defaults, rows and private constants are excluded from candidates. Candidates beyond safe size limits cannot be approved without explicit valid reauthoring.

## Checks actually run

- `npm run typecheck` passed.
- `SHADOWUI_DIST_DIR=.next-verification npm run build` passed, including `/admin/components` and administrator API routes.
- `npm test`:187 passed, four emulator-dependent tests skipped outside emulator mode.
- Full catalog/auth/review suites against the local Firebase Auth and Firestore emulators:19 passed, zero skipped.
- Real Chrome local workspace tests (no API mocks): inventory quantities and shortages, refresh/undo,320px RTL overflow, expense/chart/balance edits, same-workspace budget follow-up, calculator invalid-input recovery.
- Chrome signed-out administrator tests:320px RTL/keyboard usability and unauthorized listing/all mutation rejection.
- Authenticated Chrome emulator test: synthetic local Google identity, private creation, candidate preview, before/after simulated edit, explicit save, pending review, approval, separate shared definition and unchanged private source.

These are targeted browser suites (`simulation.spec.ts`, `admin-review.spec.ts`, `admin-authenticated.spec.ts`). The full historical browser suite was not run. The emulator Google popup loads public JavaScript and font assets; the no-cost claim concerns provider calls and real account/database actions, not an entirely network-free browser session.

## Limits

Language understanding is a deterministic simulation, not demonstrated general AI. Unknown formulas remain input tools with an explicit limitation rather than invented algorithms. Glossary conversion supports `term: definition` entries separated by newlines or semicolons. Ordinary clicks, calculations and source updates run locally. Simulated administrator language edits support compact/wide layout and Hebrew titles; other edits use the form/validated definition editor.

Workspaces and undo state live in browser storage. Without emulators, private definitions use an ignored local file and administrator sign-in is unavailable. The emulator launch uses a demo project and ephemeral emulator storage; it is not a production/shared persistence deployment. See [setup](local-simulation.md).
