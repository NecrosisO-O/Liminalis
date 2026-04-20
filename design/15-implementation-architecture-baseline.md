# Liminalis Implementation Architecture Baseline

## Status

- Accepted implementation-facing architecture baseline

## Purpose

This document turns the settled architecture work into an implementation-facing baseline for `Liminalis` v1.

It identifies the minimum complete runtime shape, the major component surfaces, the core constraints that must not be violated during implementation, the recommended delivery order, and the deferred items that should remain outside `v1` scope.

## 1. v1 Scope Baseline

`Liminalis` `v1` should implement:

- web-only product delivery
- send-to-self as the default product anchor
- item-first outward sharing only
- trusted-device account access and recovery
- source-item lifecycle and outward-sharing lifecycle
- self-space text objects without outward-share or live-transfer expansion
- detailed history and trusted-device search
- trusted-device search over item titles and visible metadata as a `v1` baseline
- text search may use short visible summaries as metadata, but should not become protected-content full-text indexing
- confidentiality-policy evaluation
- explicit upload-session preparation and finalization before stored-object activation
- live transfer as a supported but architecturally secondary subsystem
- admin panel and instance-level strategy control

`v1` should explicitly defer:

- share-first product flow
- bot-based ingestion
- native-client-specific product delivery
- richer media-management and broader collaboration expansion

## 2. Minimum Complete Runtime Shape

The minimum complete `v1` system should include:

- Browser Frontend
- Main Backend Application
- Metadata Database
- Object Storage
- Realtime / Relay Role
- Background Jobs

These may be co-deployed pragmatically in `v1`, but their logical responsibilities must remain distinct.

## 3. Main Component Surfaces

### Frontend Surface

- main product web application
- trusted-device and recovery pages
- active timeline and history views
- upload and sharing interactions
- live-transfer pages
- admin web panel

### Backend Surface

- identity and admission handlers
- trusted-device and recovery handlers
- source-item lifecycle handlers
- sharing and delivery handlers
- confidentiality-policy evaluation layer
- history and lookup query layer
- admin control-plane handlers
- live-transfer session coordination support

### Data Surface

- metadata database for state and relationships
- object storage for ciphertext bodies and chunks

### Runtime Support Surface

- realtime or relay role for live transfer
- background-job execution for expiry, purge, and cleanup

## 4. Core Objects To Preserve During Implementation

Implementation should preserve the architectural distinction of these objects:

- User
- TrustedDevice
- RecoveryCredentialSet
- SourceItem
- AccessGrantSet
- ShareObject
- ExtractionAccess
- PublicLink
- LiveTransferSession
- PolicyBundle

Implementation should also preserve these supporting architectural objects:

- UserDomainAccessPublicKey
- DevicePublicIdentity
- UploadSession
- RetrievalAttempt

Implementation should also preserve the rule that:

- `ActiveTimelineItem` and `HistoryEntry` are read models, not primary business objects

## 5. Core State Rules To Preserve During Implementation

Implementation should preserve these state-model properties:

- source items use retained inactive states rather than collapsing every terminal condition into deletion
- share objects distinguish revoked, expired, source-invalidated, and retained consumed inactive reasons
- password extraction and public links retain independent access-state logic
- live transfer uses a dedicated session state machine with separate transport substate
- burn-after-read uses a purge path and should not leave retained history or search traces
- burn-after-read should become logically unavailable immediately, even if physical purge work finishes asynchronously
- source items should not become active until upload finalization succeeds
- source invalidation cascades into derived outward-share invalidation
- parent-share revocation, expiry, source invalidation, or burn-after-read purge should cascade into derived extraction and public-link unavailability
- ordinary no-repeat share consumption closes the ordinary recipient path while leaving sibling extraction and public-link objects governed by their own access states
- one share object may expose multiple independently tracked public-link objects

## 6. Security Baseline

Implementation should preserve these security rules:

- protected flows remain distinct from public-link convenience delivery
- trusted-device access remains distinct from account identity alone
- confidentiality policy controls access, defaults, and transport permissions
- object-level access visibility should be represented explicitly rather than inferred ad hoc from account identity alone
- successful recovery should trigger re-evaluation or re-grant of historical object access under the same trusted-access domain rules
- identity-bound protected sharing should require recipient-published public wrapping material rather than hidden server-side recipient-root access
- confidentiality policy does not switch the core content-encryption algorithm per level in `v1`
- large-file handling must support chunked or streaming processing
- content bodies should be reused where possible while share objects carry delivery-specific access and lifecycle state
- public-link convenience delivery should stay controlled through short-lived delivery access rather than unmanaged long-lived direct object links

## 7. Implementation Red Lines

Implementation should not:

- require whole-file-in-memory processing for large files
- collapse live transfer and stored transfer into one shared lifecycle engine
- reduce share objects to flags on source items
- scatter confidentiality-policy decisions throughout unrelated modules without a recognizable policy layer
- let public-link exceptions weaken protected-flow assumptions
- retain burn-after-read objects in history or search
- reduce trusted devices to plain sessions
- silently expand `v1` search into full-text protected-content indexing without an explicit architectural decision
- auto-downgrade an identity-bound protected share into a weaker hidden path when recipient public wrapping material is absent

## 8. Recommended Delivery Order

### Foundation

1. identity and admission
2. trusted-device onboarding and recovery
3. minimal confidentiality-policy engine and policy-bundle model

### Stored Transfer Core

4. source-item lifecycle
5. object storage path for files and grouped content
6. self active timeline and retrieval basics

### State Retention And Lookup

7. history and lookup layer
8. expiry, invalidation, cleanup, and purge jobs

History is scheduled in this phase because it is a first-class product surface, not an optional audit add-on.

### Outward Share Modes

9. user-targeted sharing
10. password extraction
11. public links

### Policy Integration

12. full confidentiality-policy wiring across source, share, retrieval, live transfer, and admin decisions

### Realtime Subsystem

13. live transfer session and fallback behavior

Live transfer is implemented later not because it is unimportant, but because it is an architecturally distinct subsystem that should be layered on top of a stable stored-transfer core.

### Control Plane Completion

14. full admin panel limits, state, and strategy surfaces

## 9. Deferred Assumptions To Carry Forward

- `v1` should not implement share-first
- architecture should not block future share-first support
- `v1` should not expand to bot or native-client delivery targets yet
- implementation should preserve extension room without paying full complexity cost now

## 10. Completion Condition

The architecture baseline is ready to support implementation when developers can derive:

- the major services and roles
- the object model
- the key lifecycle states
- the security boundaries
- the storage placement rules
- the recommended delivery order

without reopening settled product-design questions.
