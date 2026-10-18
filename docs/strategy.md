# ShadowUI submission strategy

## Product claim and hero

ShadowUI is an intent-to-interface compiler with a bounded, trusted component grammar. Lead with a staffing decision, not a gallery of generated screens: changing real application availability produces a conflict; the interaction model becomes an alternatives comparison; a deliberate approval persists a validated schedule revision on the application server. The data change is the trigger. The consequential result is a stored receipt that can be inspected again.

Originality is a hypothesis: combining a state-triggered change in interaction model with an auditable backend commit may reduce the effort between a changed constraint and a defensible decision. Screen generation alone does not establish originality. Compare the flow with a conventional calendar and measure correction time, unnecessary clicks, comprehension and accidental approvals before claiming improvement.

The roster and shifts remain demo fixtures. A server commit is real application persistence, not a write to an employer's scheduling service. The web-based host simulates an Alexa+ host; MCP discovery and invocation are real protocol traffic. The deterministic planner is a limited offline composition engine. Live planning requires configured credentials and separate live evidence.

## Skeptical rubric

These are the organizer's four categories, applied as questions rather than invented scores. [Official overview](https://amazonappdev2026.devpost.com/)

| Criterion | Evidence to show | Remaining weakness |
|---|---|---|
| Tech Implementation | Actual MCP discovery/call; calculated conflicts; preview, validation, confirmed server receipt; reject stale revisions | Local single-instance persistence is not production infrastructure; no physical Alexa+ proof |
| Design | Calendar becomes a decision surface after an availability change; recoverable work; visible draft/commit boundary | Test whether first-time users understand the transformation; small-screen and keyboard evidence needed |
| Potential Impact | One staffing workflow with concrete changed constraints and a recoverable decision | No measured customer adoption, time savings, paid demand or field deployment |
| Quality of the Idea | Data-driven interaction-model change and reusable primitives with consequential state | Generative UI and scheduling already exist; no novelty or winning claim is justified without comparison |

## Verified competition boundary

Checked October 18, 2026 against organizer-controlled sources. The deadline is **October 23, 2026, noon PDT (22:00 Jerusalem)**. October 21 evening is the user's internal readiness target, not the submission deadline. The Alexa+ path accepts MCP **2025-11-25 or later** over Streamable HTTP; a clearly demonstrated web simulation is an alternative. The video must be under three minutes. English materials or translations, judge-accessible code, setup instructions and developer-tool feedback are required. [Official rules](https://amazonappdev2026.devpost.com/rules)

The FAQ says the gated Alexa+ SDK/toolkit/CLI/simulator are unavailable to participants and permits an entrant-built front end. No access or certification is implied. [Organizer FAQ](https://amazonappdev2026.devpost.com/details/faqs)

Amazon describes a **$190,000 combined cash and AWS-credit pool**. This is a total pool, not an individual award or expected outcome. [Amazon Developer announcement](https://community.amazondeveloper.com/t/aug-31-2026-hackathon-ring-updates/29048)

Do not claim the AWS Builder mini-challenge merely because this is an Amazon submission. Record an actual qualifying integration before selecting it. Keep any separate open-source mini-challenge claim separate from the main product repository. Recheck organizer sources immediately before submission; eligibility remains the organizer's decision.

## Evaluation boundary

`tests/evaluation.test.ts` evaluates five different capability situations rather than checking five preselected titles. It exercises schema validity, composed component affordances, changed scheduling constraints, deterministic candidate quality, preserved state, and honest unsupported-action handling. Unit assertions establish code behavior, not browser usability or open-ended intelligence. The implementation remains bounded by its grammar and demo heuristics.

## Recorded evaluation evidence

On October 18, 2026, `node --import tsx --test tests/evaluation.test.ts` completed with **5 tests passed, 0 failed**. The five cases cover scheduling conflict/review/commit/reinspection with stale-revision rejection and idempotent receipt replay; a much tighter days-off constraint; study-state preservation; mixed volunteer/project/budget composition; and an unsupported payment/booking request with an honest local alternative.

The first run caught a real defect: inserting a second notes component reused its ID and failed schema validation. The planner fix gives the capability-boundary component a distinct stable ID; the recorded rerun passes. These tests execute deterministic planner and backend-store functions in isolated temporary storage. They do **not** establish browser usability, deployed durability, live-provider quality, HTTP transport behavior or physical Alexa+ execution. Record those as separate evidence when performed.
