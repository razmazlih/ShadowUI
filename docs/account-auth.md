# Firebase account authentication

The workspace account panel shares the existing Firebase client app with catalog authentication. Configure the existing `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, and `NEXT_PUBLIC_FIREBASE_APP_ID` build variables.

In Firebase Authentication:

1. Enable Google and Email/Password sign-in.
2. Keep **One account per email address** enabled. Existing duplicate Firebase users are not merged by trusting an email string.
3. Add the actual site hostname to Authorized domains.
4. Configure the verification and password-reset email templates and sender.

The client explicitly uses local authentication persistence. Workspace ownership must be assigned only when `user.emailVerified` is true. Email/password registration sends a verification email; the account panel provides resend and verification refresh actions. A failed email delivery leaves the new user signed in but unverified, so resend remains available.

Verified Google users can add a password to their current Firebase UID. Verified password users can link Google after a separate memory-only Google sign-in proves ownership of the exact same email; the active account UID is retained. Firebase's trusted-provider behavior can also resolve sign-in to an existing UID. When Firebase reports `auth/account-exists-with-different-credential`, the pending Google credential stays only in memory and is linked after verified email/password sign-in for the matching email. A page refresh discards the pending credential and the user can retry Google linking after signing in.

These flows never merge two independently existing UIDs. Historical duplicates require an explicit server-side migration that verifies ownership of both accounts; this implementation does not provide such an administrative migration.

Reference documentation: [account linking](https://firebase.google.com/docs/auth/web/account-linking), [Google sign-in](https://firebase.google.com/docs/auth/web/google-signin), [user management and email verification](https://firebase.google.com/docs/auth/web/manage-users), and [authentication persistence](https://firebase.google.com/docs/auth/web/auth-state-persistence).

Local typechecking does not establish that providers, domains, live email delivery, or popup sign-in are configured in the deployed Firebase project. Verify those separately with test accounts before release.

## Branded verification emails

The server route `/api/account/verification` sends the Hebrew RTL HTML/text template through Resend when `RESEND_API_KEY`, `VERIFICATION_EMAIL_FROM` (a verified sender), and `APP_URL` (the canonical HTTPS origin) are all configured. It validates the Firebase bearer token, looks up the current account email server-side, and rate-limits delivery per UID in Firestore to once per minute. Delivery failure is reported; the client does not claim a message was sent.

Without that configuration, the existing Firebase email delivery remains available. To use the automatic handler with those default emails, set the verification template action URL in Firebase Authentication to `https://YOUR_DOMAIN/auth/verify`. Do not change the password-reset action URL to this verification-only handler.

Branded messages contain Firebase-generated single-use action codes linking directly to `/auth/verify`. The page applies the action code automatically, refreshes the local session if present, removes the code from browser history, and immediately navigates to `/`. Invalid/expired links show an error and a link to request another message. Verification on another browser does not sign that browser into the account. The account tab already refreshes verification on focus and periodically while visible.

Deployment, sender-domain verification, and real inbox delivery must be verified separately; local tests do not establish these.

## Google sign-in without popups

Account sign-in uses `signInWithRedirect` in the same tab; the account observer consumes `getRedirectResult` and reports return errors, retaining verified-account conflict linking. Catalog sign-in and the separate account-link proof still use popups.

The main browser Auth instance uses the current site host as `authDomain`. Next.js transparently proxies `/__/auth/*` GET/POST requests to `<NEXT_PUBLIC_FIREBASE_PROJECT_ID>.firebaseapp.com`, avoiding third-party storage dependence. Before deploying, add each supported hostname to Firebase Authorized domains and add its exact `https://<hostname>/__/auth/handler` URL to the Google OAuth client Authorized redirect URIs. For local development use the exact local origin including port. Preview hosts need their own registration. The proxy alone does not authorize an OAuth callback. See [Firebase redirect setup, option 3](https://firebase.google.com/docs/auth/web/redirect-best-practices#option-3-proxy-auth-requests-to-firebaseappcom).

Live Google login and OAuth callback configuration must be verified separately; isolated SDK tests do not establish production login success.
