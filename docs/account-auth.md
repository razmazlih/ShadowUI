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
