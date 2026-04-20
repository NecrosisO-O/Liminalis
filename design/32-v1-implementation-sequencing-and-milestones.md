# Liminalis v1 Implementation Sequencing And Milestones

## Status

- Detailed implementation-planning note

## Purpose

This document defines the implementation sequencing baseline for `Liminalis` `v1`.

Its role is to turn the now-stable planning corpus into a cautious delivery order that protects architectural boundaries, reduces rework risk, and keeps the code phase from inventing behavior ad hoc.

This note is not an issue tracker and not a sprint plan. It defines:

- what must exist before other work is safe
- what may be parallelized later
- which milestones mark meaningful system capability increases
- which risky areas should be delayed until their dependencies are stable

## 1. Sequencing Principles

- build enabling foundations before user-facing feature breadth
- prefer stable write-side behavior before richer read-side convenience
- do not let convenience exceptions arrive before protected-flow boundaries are stable
- keep live transfer late enough that it layers on top of a stable stored-transfer core
- do not let admin surfaces define domain rules that core modules should own
- avoid parallelizing work that would force repeated rewrites of object state, access rules, or retrieval semantics

## 2. High-Level Critical Path

The safest `v1` critical path is:

1. identity, admission, and session foundation
2. trusted-device bootstrap and recovery core
3. key/access substrate, public wrapping material, package-family metadata, and `AccessGrantSet`
4. minimal confidentiality-policy engine
5. stored-transfer ingestion core
6. protected self retrieval core
7. lifecycle jobs and write-side invalidation behavior
8. read-model projections for timeline, history, and search
9. outward share modes
10. admin control-plane completion
11. live transfer subsystem
12. resilience and maintenance refinements

## 3. Phase 1: Identity And Session Foundation

### Scope

- invite registration
- username-based login
- approval gating
- enabled/disabled enforcement
- cookie session baseline
- post-login routing into waiting, untrusted, or trusted entry points

### Why This Must Come First

- every protected flow depends on authenticated account identity
- pending/approved/disabled account behavior must be correct before trusted-device or upload work begins
- session meaning must be fixed early so later protected routes do not accidentally treat login as decryption authority

### Exit Condition

- the system can create, authenticate, approve, disable, and re-enable users safely
- browser sessions exist without being confused for trusted-device access

## 4. Phase 2: Trusted-Device And Recovery Core

### Scope

- first trusted-device establishment
- publication of `UserDomainAccessPublicKey`
- device identity generation and publication
- QR pairing and short-code fallback
- core recovery flow and rotation
- local trust-material storage success criteria

### Why This Comes Second

- all protected retrieval and identity-bound sharing depend on device trust and published wrapping material
- recovery is foundational security behavior, not late polish

### Exit Condition

- one account can establish trusted-device access, add another device, recover with recovery codes, and publish the public wrapping material required for later protected sharing

## 5. Phase 3: Key/Access Substrate And AccessGrantSet

### Scope

- ordinary and recovery package-family metadata model
- `AccessGrantSet` persistence and replace-on-change rules
- owner-domain versus owner-device-snapshot logic
- recipient-domain versus recipient-device-snapshot substrate support
- retrieval package-resolution prerequisites

### Why This Must Precede Stored Transfer Activation

- source-item finalization already depends on package families and `AccessGrantSet`
- without this layer, upload would create objects whose future retrieval semantics are still undefined

### Exit Condition

- the system can represent protected object access structurally, not just infer it from account state

## 6. Phase 4: Minimal Confidentiality-Policy Engine

### Scope

- current `PolicyBundle` loading
- source-creation evaluation
- core snapshot output generation
- share-creation evaluation skeleton
- fixed-rule versus editable-field validation boundary

### Why This Comes Before Upload Finalization

- upload preparation needs policy outputs
- source snapshots need a real producer before source-item activation is safe

### Exit Condition

- the backend can evaluate source creation and return snapshot-ready policy outputs with one stable typed contract

## 7. Phase 5: Stored-Transfer Ingestion Core

### Scope

- upload-session creation
- ciphertext-part upload and resumability
- finalization-before-activation
- grouped-content manifest handling
- source-item creation with access packages and snapshots

### Sequencing Rule

- upload preparation and finalization should be the first end-to-end protected content path
- source items must not become active until finalization succeeds

### Accepted Prepare-Lock Rule

- upload-session preparation locks the source-creation policy result for that session
- if the session remains valid, finalization uses the locked result rather than re-checking current policy
- later policy edits block newly created upload sessions instead of invalidating already prepared valid sessions

### Exit Condition

- a user can create active self-space source items for files, grouped files, folders, and text with correct policy snapshots and access structure

## 8. Phase 6: Protected Self Retrieval Core

### Scope

- protected retrieval for `SourceItem`
- `RetrievalAttempt` creation and completion confirmation
- owner package issuance
- basic retrievability state updates

### Why This Comes Before Outward Sharing

- self retrieval is the first proof that upload, access packages, trusted-device access, and completion accounting all work together
- outward sharing should layer on top of already-working protected stored transfer, not define it

### Exit Condition

- self-space protected retrieval works end-to-end with correct success accounting and without relying on outward-share abstractions

## 9. Phase 7: Lifecycle Jobs And Write-Side State Handling

### Scope

- source expiry and invalidation jobs
- burn-after-read purge work
- upload-session cleanup
- basic share/source invalidation cascades

### Why This Should Come Before Rich Read Models

- timeline/history/search should project stable outcomes, not moving target semantics
- write-side invalidation and purge behavior should be authoritative before projections become depended on by UI

### Exit Condition

- source and share write-side states can expire, invalidate, purge, and clean up correctly

## 10. Phase 8: Read-Model Projections

### Scope

- `ActiveTimelineItemProjection`
- `HistoryEntryProjection`
- `SearchDocumentProjection`
- outbox/projector wiring
- consumed-share representation

### Why This Comes After Write-Side Stability

- read models should follow mature source/share outcomes
- otherwise timeline/history/search would be rewritten repeatedly during core lifecycle work

### Exit Condition

- self-space timeline, detailed history, and trusted-device search become reliable first-class product surfaces over the stable write model

## 11. Phase 9: Outward Share Modes

This phase should be delivered in strict internal order.

### 9.1 User-Targeted Protected Sharing

Build first:

- `ShareObject` creation
- recipient eligibility checks
- recipient ordinary retrieval path
- no-repeat and repeat-download behavior

Reason:

- it is the most direct extension of the protected stored-transfer model

### 9.2 Password Extraction

Build second:

- `ExtractionAccess`
- password policy enforcement
- retrieval-count exhaustion

Reason:

- it depends on the already-working `ShareObject` and ordinary retrieval model

### 9.3 Public Links

Build third:

- `PublicLink`
- short-lived delivery tickets
- download-count exhaustion

Reason:

- it is the explicit convenience exception and should not arrive before protected sharing is stable

### Exit Condition

- the three outward-delivery modes work as sibling paths under one share model without weakening protected-flow assumptions

## 12. Phase 10: Full Retrieval Accounting Across Delivery Modes

### Scope

- complete attempt handling across all retrieval families
- no-repeat share consumption
- burn-after-read hooks
- extraction count decrement
- public-link count decrement

### Why This Follows The Share Modes

- the full retrieval protocol only becomes meaningful after all major delivery paths exist

### Exit Condition

- all retrieval families share one coherent accounting and completion model

## 13. Phase 11: Admin Control-Plane Completion

### Scope

- invite management surface
- approval queue and user-state controls
- disablement and re-enable actions
- confidentiality-policy editing, validation, publication, and restore defaults
- operational visibility and limited cleanup visibility

### Why This Is Later Than Core Domain Work

- admin workflows should consume identity, policy, and lifecycle services rather than force those services into premature shapes

### Exit Condition

- the instance owner can administer admission, policy, and basic operational state without violating content boundaries

## 14. Phase 12: Live Transfer Subsystem

### Scope

- live-session creation and join
- confirmation flow
- peer-to-peer-first transport
- relay fallback where allowed
- explicit live-to-stored handoff
- retained live-transfer records where policy allows

### Why This Must Stay Late

- live transfer is architecturally distinct
- it reuses identity, trust, policy, and stored-transfer fallback
- implementing it too early risks merging it incorrectly into the stored-transfer lifecycle

### Exit Condition

- live transfer works as an isolated subsystem layered on top of a stable stored-transfer core

## 15. Phase 13: Resilience, Maintenance, And Security Polish

### Scope

- recovery-rotation resilience hardening
- explicit regrant and package maintenance actions when needed
- snapshot-mode maintenance edge cases
- trusted-access removal UX for one browser
- operational cleanup refinement

### Why This Is Late

- these are important, but they should refine stable foundations rather than shape first-pass business models prematurely

### Exit Condition

- the system can handle the most important failure, rotation, and maintenance edges without undermining the core product model

## 16. Parallelization Guidance

Once Phase 5 is stable, some work may proceed in parallel with careful boundaries.

### Safe Later Parallelism

- lifecycle jobs can advance in parallel with early retrieval hardening
- read-model projector work can begin once write-side event vocabulary stabilizes
- admin control-plane work can begin once identity and policy publication rules are stable

### Unsafe Early Parallelism

- do not split stored-transfer ingestion from the access-package substrate
- do not build user-targeted protected sharing before recipient wrapping publication is stable
- do not build live transfer in parallel with foundational stored-transfer lifecycle work

## 17. Hidden Dependency Traps

### 17.1 Session/Trust Conflation Trap

- protected routes must not assume login session equals trusted-device access

### 17.2 Upload-Without-Access Trap

- upload finalization must not create active source items before package families and `AccessGrantSet` exist

### 17.3 Read-Model-Too-Early Trap

- do not depend on projections before lifecycle and retrieval semantics are stable enough to project correctly

### 17.4 Sharing-Before-Recipient-Material Trap

- identity-bound protected sharing must not be built before recipient public wrapping material publication and lookup are stable

### 17.5 Live-Transfer-Too-Early Trap

- live transfer must not define the system's primary transfer lifecycle by arriving before the stored-transfer core is mature

## 18. Milestone Shape

The safest milestone shape is:

- `M1`: accounts, sessions, invites, approval, disablement, first trusted device
- `M2`: trusted-device pairing, recovery core, public wrapping publication, package/access substrate
- `M3`: minimal policy engine plus source-item upload/finalization for self-space text and file content
- `M4`: self protected retrieval plus lifecycle jobs
- `M5`: active timeline, detailed history, narrow search
- `M6`: user-targeted protected sharing
- `M7`: password extraction and public links
- `M8`: admin control-plane completion
- `M9`: live transfer and explicit stored fallback
- `M10`: resilience and maintenance polish

## 19. Review Rule During Sequencing

Every major phase transition should briefly re-check:

- whether any new code work is drifting across module boundaries
- whether convenience behavior is weakening protected-flow assumptions
- whether read-model convenience is starting to define write-side truth
- whether admin workflows are starting to own domain behavior they should only orchestrate

## 20. Immediate Sequencing Recommendation

The next implementation-planning outputs after this note should derive directly from the sequence above, in this order:

1. backend domain and service breakdown
2. API and route planning
3. ticket or milestone decomposition aligned to the phases and milestones here

## 21. Remaining Watchpoints

The sequencing baseline is stable enough to guide code work, but these watchpoints should remain explicit:

- package-blob physical storage details still need later API-facing concretization
- projector physical schema and rebuild strategy still need later concrete design
- live-transfer realtime contract still needs later interface planning
- canonical summaries should continue to stay aligned with later accepted notes if any further behavior refinements are accepted
