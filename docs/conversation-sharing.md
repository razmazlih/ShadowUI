# Conversation links and sharing

Every saved workspace has a stable `/conversations/{id}` page and a corresponding
`GET /api/conversations/{id}` endpoint. Opening your own conversation restores it
in the editable workspace. Guest conversations can be reopened on the same browser;
sharing across devices requires a verified account and successful cloud sync.

The Share button replaces Export. The owner can choose private access, specific
verified email addresses, or anyone with the link. Email access does not send an
email: the owner copies and sends the link. Recipients get a read-only view.
The original image download remains available inside Share.

Permissions are enforced by server APIs using verified Firebase ID tokens. Sharing
records are server-only Firestore documents; the existing deny-all client rules
remain in effect. Shared reads resolve the owner's latest cloud workspace, so
cloud edits are reflected and removing the workspace removes access to its content.
Revoking link access prevents subsequent API reads; it cannot erase copies a
recipient already saved. Account sync and sharing both require the existing
Firebase server credentials in the environment where the app runs.

The share dialog has a dedicated guest step with sign-in and registration actions.
Authentication retains a validated local return URL, restores the selected
conversation after account sync, and reopens sharing. The verification return is
retained in the same browser session for one hour. The dialog displays no raw URL;
verified owners use Copy link. Motion respects reduced-motion preferences.
