# Liminalis v1 Milestone Decomposition And Acceptance

## Status

- Detailed implementation-planning note

## Purpose

This document refines the sequencing baseline into milestone-level decomposition and acceptance criteria for `Liminalis` `v1`.

Its goal is to make each milestone concrete enough that later implementation work can judge whether a milestone is truly complete without reopening behavior questions already settled elsewhere.

This note is still above ticket granularity. It defines milestone scope boundaries, dependencies, and acceptance conditions.

## 1. Milestone Principles

- each milestone should deliver a coherent capability, not a scattered set of unrelated partials
- each milestone should stop at a stable domain boundary rather than leaking unfinished cross-cutting behavior downstream
- milestones should be considered complete only when their acceptance criteria can be demonstrated against the planning corpus

## 2. Milestone Dependency Chain

The milestone dependency chain is:

- `M1 -> M2 -> M3 -> M4 -> M5 -> M6 -> M7 -> M8 -> M9 -> M10`

No later milestone should be treated as complete if it quietly compensates for missing foundations from earlier milestones.

## 3. M1: Identity, Admission, And First Trusted Device Entry

### Scope

- invite registration
- username/password login
- pending approval and enabled/disabled enforcement
- secure session baseline
- post-login bootstrap routing
- first trusted-device establishment path

### Acceptance Criteria

- a user can register with a valid invite and then authenticate
- a pending user is limited to the waiting-for-approval surface
- a disabled user is blocked from ordinary product entry
- a first approved user with no trusted devices is routed into first trusted-device establishment
- first trusted-device setup ends with a trusted browser and visible recovery-code interruption

### Not Yet Included

- later-device pairing
- recovery fallback
- protected retrieval
- upload and source-item creation

## 4. M2: Trust Expansion, Recovery Core, And Access Substrate

### Scope

- QR pairing and short-code fallback
- recovery flow and rotation
- publication of `UserDomainAccessPublicKey`
- publication of `DevicePublicIdentity`
- package-family metadata substrate
- `AccessGrantSet` core persistence and resolution rules

### Acceptance Criteria

- a second device can become trusted only through explicit approval
- ordinary pairing does not silently widen snapshot-limited historical access
- recovery can restore trust into the same long-term trusted domain
- the rotated recovery-code set is re-displayable within the same recovered session until acknowledgment
- the system can persist and resolve `AccessGrantSet` and package-family metadata for protected objects structurally rather than inferring from current devices alone

### Not Yet Included

- source-item upload/finalization
- outward sharing
- full retrieval accounting

## 5. M3: Policy Evaluation And Stored-Transfer Creation

### Scope

- minimal `PolicyBundle` loading and source-creation evaluation
- upload-session preparation
- resumable ciphertext-part upload
- grouped-content manifest handling
- upload finalization-before-activation
- source-item creation with source snapshots and source-side access packages

### Acceptance Criteria

- upload preparation returns locked source-creation policy results
- upload finalization cannot activate a source item before all parts and metadata are valid
- a valid prepared session can still finalize even if later policy edits would block a newly created session
- single-file, grouped-file, folder, and self-space text source-item creation all fit the accepted stored-transfer model
- a created source item has a valid snapshot and `AccessGrantSet`

### Not Yet Included

- self retrieval
- history/search projections
- outward sharing modes

## 6. M4: Protected Self Retrieval And Core Lifecycle Jobs

### Scope

- protected retrieval for `SourceItem`
- retrieval-attempt creation
- owner package issuance
- client completion confirmation
- lifecycle jobs for source expiry, upload cleanup, and burn-after-read purge on source items

### Acceptance Criteria

- a trusted device can retrieve a self-space source item through the protected retrieval path
- successful protected retrieval requires client-confirmed usable decryption
- retries do not double-consume retrieval outcomes
- source expiry and invalidation occur correctly
- burn-after-read makes a source item logically unavailable immediately and purges it through the accepted purge path

### Not Yet Included

- outward share retrieval
- history/search read models
- public-link delivery tickets

## 7. M5: Active Timeline, Detailed History, And Narrow Search

### Scope

- active timeline projection
- history projection
- narrow search projection
- consumed-share-ready read-model vocabulary even if outward sharing is not fully exposed yet

### Acceptance Criteria

- active self-space items appear in the active timeline with accepted visible metadata only
- retained history shows non-active records with retrievability detail and concrete retained reasons
- search covers approved title and visible-metadata fields only
- projections are derived from write-side truth rather than replacing it
- burn-after-read items do not persist as retained history or search after purge completion

### Not Yet Included

- outward share creation
- password extraction
- public links
- retained live-transfer records

## 8. M6: User-Targeted Protected Sharing

### Scope

- `ShareObject` creation
- recipient eligibility and wrapping-material checks
- recipient protected retrieval path
- repeat-download and no-repeat share behavior
- retained `consumed` share outcome

### Acceptance Criteria

- a source item can create a user-targeted protected share only when recipient wrapping prerequisites are satisfied
- a recipient can retrieve an eligible share through the protected retrieval model
- repeat-download and no-repeat semantics behave according to the accepted domain-scoped model
- no-repeat shares become retained `consumed` records rather than misreported revoked or expired records
- sibling extraction/public-link paths are not silently invalidated merely because the ordinary recipient path was consumed

### Not Yet Included

- password extraction
- public links
- live transfer

## 9. M7: Password Extraction And Public Links

### Scope

- `ExtractionAccess`
- extraction password policy enforcement
- extraction retrieval-count accounting
- `PublicLink`
- short-lived public-link delivery tickets
- public-link download-count accounting

### Acceptance Criteria

- extraction access can be created from an eligible share object and retrieved through its own password-first path
- extraction retrieval count only decrements after successful completion semantics
- public links are created as tracked managed objects, not unmanaged raw URLs
- public-link download requires short-lived delivery access
- public-link count only decrements on successful response completion

### Not Yet Included

- live transfer
- retained live-transfer records
- admin control-plane completion

## 10. M8: Admin Control-Plane Completion

### Scope

- invite management surface
- approval queue and user-state controls
- disable/re-enable operations
- policy validation/publication/history/restore-defaults flows
- operational visibility and limited cleanup visibility

### Acceptance Criteria

- admins can manage invites, approvals, disablement, and policy publication without bypassing business-owner domains
- policy edits validate and publish through new `PolicyBundle` versions
- restore-defaults produces new current bundle versions rather than mutating history
- operational visibility stays within control-plane metadata boundaries and does not expose user content

### Not Yet Included

- live transfer
- late resilience or regrant polish

## 11. M9: Live Transfer And Explicit Stored Fallback

### Scope

- live-session creation/join/confirmation
- p2p-first transport
- relay fallback when allowed
- explicit live-to-stored handoff
- retained live-transfer records where policy allows them

### Acceptance Criteria

- live transfer works as a distinct session subsystem and not as a hidden stored-transfer extension
- relay is used only when current policy allows it
- failed live transfer does not by itself create stored objects
- live-to-stored fallback creates a new stored-transfer flow explicitly
- retained live-transfer records remain visibly distinct from stored-transfer timeline/history objects

### Not Yet Included

- late resilience and maintenance refinements

## 12. M10: Resilience And Maintenance Polish

### Scope

- recovery resilience hardening
- explicit regrant and package maintenance actions where needed
- snapshot-mode maintenance edge cases
- trusted-access removal-from-browser behavior
- operational cleanup refinement

### Acceptance Criteria

- recovery interruption survives refresh/reload within the accepted same-session re-display contract
- explicit regrant and package maintenance follow versioned package/`AccessGrantSet` semantics
- trusted-access removal is separate from logout and behaves consistently with earlier trust rules
- late maintenance behavior does not undermine any earlier milestone's security or lifecycle guarantees

## 13. Milestone Review Rule

Before a milestone is declared complete, the review should check:

- whether the milestone respects the accepted domain boundaries
- whether any convenience path weakened protected-flow assumptions
- whether read-model work started defining write-side truth
- whether admin surfaces started bypassing business-owner services
- whether the milestone left behind hidden dependency debt that should have been solved in an earlier phase

## 14. Recommended Next Sequencing Artifacts

The next planning artifacts after this milestone note should be:

1. ticket decomposition aligned to `M1` through `M10`
2. explicit dependency mapping between modules and milestones
3. implementation execution planning derived from the sequencing and API notes
