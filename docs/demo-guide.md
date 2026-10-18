# ShadowUI demo guide

Record a single truthful story in **2:50**, leaving editing margin. Use the actual running app, not a narrated design prototype. Use a clean demo roster; no personal information or secrets.

## First 90 seconds

| Time | On screen | Spoken point |
|---|---|---|
| 0:00–0:08 | Type the shift-planning objective; roster appears | “A team plan, built around an objective.” |
| 0:08–0:18 | Mark Daniel unavailable Wednesday; conflict surface appears | “The data changed. The interface changed without another prompt.” |
| 0:18–0:35 | Compare replacements; preview one and reject or apply | “Each alternative is checked against the same constraints.” |
| 0:35–0:55 | Explicitly confirm and show the server receipt | “This commits to ShadowUI's server, not an employer service.” |
| 0:55–1:15 | Reload; the receipt and assignments return | “This result is persisted state, not generated text.” |
| 1:15–1:30 | Undo the commitment; show the restored draft | “You keep control. Significant changes are recoverable.” |

At **20 seconds**, the target is to show a data-driven transformation. At **60 seconds**, the target is a validated consequential result. At **90 seconds**, the target is recovery and human control. These are rehearsal targets, not measured novice-user comprehension results. Use a prefilled goal only if the video clearly identifies the interaction and does not imply unseen inference.

## Remaining 80 seconds

| Time | On screen | Spoken point |
|---|---|---|
| 1:30–1:50 | Change the minimum-days-off rule; inspect warnings and alternatives | “The same code recomputes feasibility; suggestions are not silently committed.” |
| 1:50–2:10 | Study workspace; complete an item; request one hour tonight | “A reusable grammar also supports learning and preserves completed work.” |
| 2:10–2:30 | Unfamiliar mixed request: compare community projects for next week with a budget | “Independent comparison, time, budget and action primitives compose together.” |
| 2:30–2:45 | Reveal MCP tools/call trace or client host | “This is a web-based simulated host using a real MCP endpoint.” |
| 2:45–2:50 | Close on product with visible demo label | “Bounded components. Real state. The interface follows the work.” |

## Recording checks

- Confirm every described feature actually exists in this checkout before recording; substitute nothing with edited screenshots.
- Rehearse a full fresh-browser run and record actual response times. Do not present sped-up execution as real-time latency.
- Show one failure boundary: a stale revision or blocked commit should visibly fail without overwriting saved work.
- Label demo fixtures, simulated Alexa+ host, optional live AI and server-local persistence on screen or in captions.
- Keep conflict, candidate, commit and receipt legible. A quick registry flash is less useful than a visible causal result.
- If the server persistence path is not mounted persistently in deployment, say so; do not claim restart durability there.
- Keep the final upload under three minutes and provide English narration or captions. [Official submission rules](https://amazonappdev2026.devpost.com/rules)

## Conversation history

In **Local demo**, the sidebar includes ten Hebrew sample conversations, newest first (7–18 October 2026, Israel time). Open any title to read the entire transcript and edit its local outcome using existing notes, checklists, calendar, timeline, comparison and chart components. The recorded follow-ups demonstrate revisions; they are not a live assistant session. Use **New workspace** to try a new request.

The source is `lib/demo-conversations.ts`. These fixtures are never merged into `shadowui.v1`, sent to `/api/plan`, or mounted as scheduling domains. Switching to **Live AI** hides them. Outcome edits are temporary and reset when leaving the conversation. All people, documents, prices and account data are fictional; email/document search and availability checks illustrate a proposed interface, not connected capabilities. No sample sends messages, creates external events or makes purchases.

Validation: `npm test`, `npm run typecheck`, and `tests/e2e/demo-history.spec.ts` (desktop/mobile, all ten transcripts, no API calls, existing workspace storage preserved, Live mode separation).
