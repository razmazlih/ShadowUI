# Firebase accounts and conversation sync

The home page uses Firebase Authentication and a device-local guest profile. Verified accounts sync their workspace snapshots through the application's authenticated API to Firestore. Firebase UID is the owner identity; the API never accepts an email or UID from the request body as authorization.

## Firebase project setup

1. In Firebase Authentication, enable **Google** and **Email/Password** providers. Set the Google support email and authorized application domains, including the deployed hostname and localhost for development.
2. Keep the account setting **Link accounts that use the same email** / one account per email enabled. Provider collisions require signing into the existing provider before linking credentials. Matching email text alone is not sufficient proof. Existing duplicated Firebase UIDs are not bulk merged by this feature.
3. Configure the verification-email and password-reset templates and their authorized action domains. Password signups must verify their email before cloud synchronization is authorized.
4. Provide all four public web settings from `.env.example`: `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, and `NEXT_PUBLIC_FIREBASE_APP_ID`. Rebuild after public configuration changes.
5. Configure matching server `FIREBASE_PROJECT_ID` and an authorized service account through `FIREBASE_SERVICE_ACCOUNT_JSON` or Application Default Credentials. The service identity needs access to the project's Firestore database and Firebase Authentication token checks. Never expose service credentials in public environment variables.
6. Create the Firestore database if it does not already exist. The server creates `shadowui_account_workspaces/{uid}` on the first successful upload. Existing deny-all client Firestore rules remain appropriate because clients use the authenticated Next.js API, while the Admin SDK is governed by server IAM.

## Sync API

- `GET /api/account/workspaces` with `Authorization: Bearer <Firebase ID token>` returns `{snapshot, revision}`. An account with no saved snapshot returns `{snapshot:null,revision:0}`.
- `PUT` uses the same authentication, a same-origin `Origin` header, `Content-Type: application/json`, and `{snapshot,expectedRevision}`. The server checks the token including revocation, requires a verified email, validates the complete snapshot, and chooses the document from the verified UID.
- A Firestore transaction increments the revision only when `expectedRevision` matches. HTTP 409 with `code: REVISION_CONFLICT` requires reading the current state and reconciling before retrying. This prevents a stale device from silently overwriting the latest cloud snapshot.
- Responses are private and `no-store`. The payload is stored as serialized JSON, avoiding Firestore restrictions on nested workspace data and undefined optional fields.
- Limits: 250 workspaces, 700,000 UTF-8 bytes of serialized snapshot, and 750,000 bytes per HTTP request. Oversized updates return HTTP 413 without replacing the cloud snapshot. Local data remains available.

## Verification boundaries

The API unit tests use injected identities and storage to verify owner isolation, unverified-user rejection, compare-and-swap conflicts, request restrictions, and service failures. An additional gated Firebase Auth + Firestore emulator integration test exercises genuine emulator ID tokens, verified/unverified/disabled identities, isolated UID documents, simultaneous competing transactions, and reading the latest saved revision. Run it with `FIREBASE_PROJECT_ID=demo-shadowui-catalog GCLOUD_PROJECT=demo-shadowui-catalog firebase emulators:exec --only firestore,auth --project demo-shadowui-catalog 'node --import tsx --test tests/account-cloud.test.ts'`. Passing these tests does not establish that production providers, email delivery, server credentials, or Firestore IAM are configured. Verify Google sign-in, real verification emails, guest migration, and synchronization in two independent browser profiles before declaring the hosted integration operational.

Guest/account histories are browser data. A user with access to the browser profile can inspect local storage. Signing out separates the visible guest history from the account cache; it is not encryption or remote deletion of the device's stored copy.

Official references: [provider linking](https://firebase.google.com/docs/auth/web/account-linking), [email/password authentication](https://firebase.google.com/docs/auth/web/password-auth), and [Firestore server access and rules](https://firebase.google.com/docs/firestore/security/rules-conditions).

## Implemented client behavior and local proof

The client keeps the last acknowledged cloud snapshot paired atomically with its device snapshot. It reconciles local changes against that base and the latest server revision, retries revision conflicts, and retains separate copies when two devices change the same conversation concurrently. Unchanged snapshots are read without rewriting Firestore. Sync runs after edits, on focus/connection recovery, and every 15 seconds while visible. The selected chat stays device-local. Failed sync remains visibly pending while the device copy is retained.

Browser schedule state and layout settings are scoped to the verified UID and included in cloud snapshots. The localhost-only MCP schedule server retains its existing server-local behavior; cross-device schedule-state syncing applies to the hosted browser schedule store. Existing history limits remain 12 messages per conversation, and cloud snapshot limits are shown above.

Verified locally with isolated browser contexts and Firebase Auth/Firestore emulators: guest work retained before verification, verification followed by migration, same account in a separate empty browser context restoring notes and chat history, edits syncing back to the first context, signout hiding account chats from the guest profile, and 320px width without horizontal overflow. Emulator verification proves application integration, not delivery by a real email provider or production Google OAuth.
