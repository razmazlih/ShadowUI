# Local simulation and component review

`npm run dev` runs the workspace with private definitions in ignored `.shadowui/simulation/definitions.json` when emulators are absent. Administrator sign-in is disabled in that mode. Browser state and local private definitions stay on this machine.

For the full private catalog → sanitized review candidate → administrator approval flow, install Firebase CLI and Java, then run:

```sh
npm run dev:simulation
```

This starts Firebase Auth and Firestore emulators for `demo-shadowui-catalog` and Next.js at http://127.0.0.1:3000. Close other emulator processes first. The launcher overrides saved production project/auth settings, clears inherited AI credentials, and uses a fake browser API key. The simulation launcher separately blocks paid model/embedding calls; paired loopback emulators and a demo project isolate database and authentication access.

Open `/admin/components`, choose Google sign-in, and create an emulator identity with email `admin@shadowui.local`. Only verified identities matching that allowlist pass server authorization. The Firebase emulator Google dialog is local simulation; it does not log into a real Google account. Firebase’s emulator dialog downloads public JavaScript/fonts from Google APIs, unpkg and Google Fonts; this flow is not completely offline. Authentication requests still target the local emulator, and model APIs remain blocked. If the emulator identity lacks verified email, update that identity through the local Auth emulator before retrying.

Generate a custom calculator or unfamiliar task in the workspace to populate the private catalog and review queue. Candidates contain synthetic names and input defaults; bounded operators and structural constants 0, 1 and -1 are preserved. Other numeric literals become editable synthetic parameters with illustrative default 1; repeated literals reuse a parameter. Original user prompts and records are excluded. Check every candidate before approving; synthetic parameter values require public examples, and their defaults do not reproduce private calculations. If the required parameters exceed safe field limits, the candidate remains invalid until an administrator reauthors it. Approval creates a separate shared definition without changing the private owner or existing pinned instances.

The launcher does not export emulator data by default, so restarting gives a clean catalog. Browser workspaces still persist in the browser. `npm run test:catalog` runs catalog, review lifecycle, privacy and verified-identity authorization tests against fresh demo emulators.

For an isolated port alongside another dev server, use `PORT=3001 npm run dev:simulation`. Authenticated Chrome coverage runs with `SHADOWUI_ADMIN_E2E=1 PLAYWRIGHT_BASE_URL=http://127.0.0.1:3001 npx playwright test tests/e2e/admin-authenticated.spec.ts`. The test skips by default and uses synthetic emulator identities only.

## Production catalog and administrator authentication

A deployment can use real Firebase when neither server emulator host is set. Configure `FIREBASE_PROJECT_ID`, server credentials (`FIREBASE_SERVICE_ACCOUNT_JSON` or application-default credentials), `FIREBASE_ADMIN_EMAIL` (comma-separated verified administrator emails), and the four `NEXT_PUBLIC_FIREBASE_*` browser settings. Browser and server project IDs must match. Enable Google sign-in and authorize the deployed hostname in Firebase Authentication. Firestore is accessed only by server routes; deploy the repository deny-direct-client rules before production use. Catalog reads initialize missing built-in definitions transactionally.

Never set emulator hosts in production. Emulation requires both Auth and Firestore loopback hosts plus an explicit `demo-` project; malformed or mixed configuration fails closed. The local administrator bypass token is accepted only in development/test with validated emulation. Real administrator tokens require verified email, an allowlist match, and revocation verification. Configuration unit tests do not connect to Firebase; catalog integration tests run only against demo emulators.
