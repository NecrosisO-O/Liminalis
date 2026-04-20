# Liminalis Backend Domain And Service Breakdown

## Status

- Detailed implementation-planning note

## Purpose

This document turns the accepted sequencing baseline into a backend domain and service breakdown for `Liminalis` `v1`.

Its goal is to define stable backend modules, what each one owns, what each one may depend on, what each one must not own, and where each module sits in the implementation sequence.

This note does not require microservices. For `v1`, most of these modules may remain inside one backend deployment unit as long as their code and ownership boundaries stay explicit.

## 1. Design Goals

- preserve domain ownership in code before implementation begins
- prevent controller-level sprawl from replacing backend service boundaries
- make sequencing dependencies concrete enough for later ticket decomposition
- protect the most fragile boundaries: trust versus session, source versus share, policy versus lifecycle, and live transfer versus stored transfer

## 2. Top-Level Backend Domains

The stable backend domains for `v1` are:

1. identity, admission, and session
2. trusted-device and recovery
3. access substrate and package management
4. confidentiality policy engine
5. source-item lifecycle and upload coordination
6. retrieval protocol and delivery authorization
7. sharing and delivery
8. lifecycle jobs and cleanup
9. history, search, and projection
10. admin control plane
11. live transfer coordination

## 3. Service Boundary Rules

- each domain should own its primary objects and core business transitions
- cross-domain calls should request explicit behavior, not reach into another domain's storage model directly
- read-model services may consume write-side outcomes, but must not become the source of lifecycle or access truth
- admin services may orchestrate other domains, but must not bypass their business rules

## 4. Identity, Admission, And Session Domain

### Owned Objects

- `User`
- `InviteCode`
- `Session`

### Responsibilities

- invite-based registration
- username/password authentication
- pending approval and enabled/disabled enforcement
- session issuance, validation, and invalidation
- post-login routing state for waiting, blocked, untrusted, and trusted entry points

### Allowed Dependencies

- none on protected-content domains

### Consumers

- trusted-device and recovery
- source-item lifecycle
- sharing and delivery
- retrieval protocol
- live transfer
- admin control plane

### Must Not Own

- trusted-device decryption authority
- protected retrieval eligibility
- source/share lifecycle state

### Sequencing Position

- Phase 1 foundation

## 5. Trusted-Device And Recovery Domain

### Owned Objects

- `TrustedDevice`
- `RecoveryCredentialSet`
- pairing-session coordination state
- recovery interruption and recovered-session coordination state
- trusted-device metadata
- publication state for `UserDomainAccessPublicKey`
- publication state for `DevicePublicIdentity`

### Responsibilities

- first trusted-device establishment
- QR pairing and short-code fallback
- trust approval and rejection
- recovery attempt and rotation
- local trust-material success criteria before trust activation
- public wrapping material publication

### Allowed Dependencies

- depends on identity, admission, and session
- may consume policy outcomes about historical-device visibility where needed

### Must Not Own

- source/share lifecycle
- read-model truth
- account admission state itself

### Sequencing Position

- Phase 2 foundation

## 6. Access Substrate And Package Management Domain

### Owned Objects

- `AccessGrantSet`
- package-family metadata
- package-family version and supersession state
- `PackageReference`
- recovery package-family metadata

### Responsibilities

- create and replace `AccessGrantSet` versions
- manage owner and recipient ordinary package families
- manage recovery package families
- resolve subject scope for retrieval and sharing
- support explicit regrant and package maintenance when needed later

### Allowed Dependencies

- identity
- trusted-device public-material state
- confidentiality policy outputs

### Consumers

- source-item lifecycle
- sharing and delivery
- retrieval protocol

### Must Not Own

- lifecycle invalidation of source/share objects
- admin publication workflow
- projection state

### Sequencing Position

- Phase 3 foundation

## 7. Confidentiality Policy Engine Domain

### Owned Objects

- current and historical `PolicyBundle` versions
- policy validation logic
- typed evaluation contracts and outputs

### Responsibilities

- load current bundle by confidentiality level
- validate admin-edited bundles before publication
- evaluate source creation and source-level change
- evaluate share creation, extraction, public links, and live transfer
- emit snapshot-ready policy outputs

### Allowed Dependencies

- largely standalone domain logic with bundle persistence

### Consumers

- source-item lifecycle
- access substrate
- sharing and delivery
- live transfer
- admin control plane

### Must Not Own

- object lifecycle mutation
- `AccessGrantSet` persistence
- retrieval accounting

### Sequencing Position

- Phase 4 foundation and later full wiring

## 8. Source-Item Lifecycle And Upload Coordination Domain

### Owned Objects

- `SourceItem`
- `UploadSession`
- `UploadPart`
- `GroupManifest`
- source-level policy snapshots
- source-side finalized storage references

### Responsibilities

- prepare upload sessions
- lock source-creation policy results at prepare time
- track resumable ciphertext-part upload
- finalize upload before source activation
- create source access packages and source-side `AccessGrantSet`
- manage grouped-content manifest persistence
- manage source invalidation and retention

### Allowed Dependencies

- identity
- trusted-device state where protected access requires it
- confidentiality policy engine
- access substrate and package management
- object-storage adapter

### Consumers

- retrieval protocol
- sharing and delivery
- lifecycle jobs
- history/search/projection

### Must Not Own

- outward-share lifecycle
- live-transfer session logic
- admin policy editing workflow

### Sequencing Position

- Phase 5 stored-transfer core

## 9. Retrieval Protocol And Delivery Authorization Domain

### Owned Objects

- `RetrievalAttempt`
- attempt reconciliation state
- completion-confirmation state
- public-link delivery-ticket issuance state

### Responsibilities

- create or resume retrieval attempts
- validate lifecycle eligibility before issuance
- resolve current package family or delivery ticket
- issue package references for protected flows
- require client completion confirmation for protected retrieval
- trigger downstream accounting hooks after completion

### Allowed Dependencies

- source-item lifecycle
- sharing and delivery
- access substrate
- identity
- trusted-device state

### Must Not Own

- object lifecycle truth
- raw storage authorization by itself
- admin workflow logic

### Sequencing Position

- Phase 6 for self retrieval, Phase 10 for full cross-mode accounting

## 10. Sharing And Delivery Domain

### Owned Objects

- `ShareObject`
- `ExtractionAccess`
- `PublicLink`
- share-level policy snapshots
- share-side `AccessGrantSet` creation trigger

### Responsibilities

- create share objects from source items
- enforce share validity and revocation
- manage sibling outward-delivery modes
- enforce extraction password and retrieval-count rules
- enforce public-link validity and download-count rules
- block identity-bound protected sharing when required recipient public material is absent

### Allowed Dependencies

- source-item lifecycle
- identity
- confidentiality policy engine
- access substrate
- trusted-device public-material publication state

### Consumers

- retrieval protocol
- lifecycle jobs
- history/search/projection

### Must Not Own

- live-transfer subsystem
- source-item upload coordination
- recipient trust establishment itself

### Sequencing Position

- Phase 9 outward share modes

## 11. Lifecycle Jobs And Cleanup Domain

### Owned Objects

- lifecycle job coordination state
- purge and cleanup execution state

### Responsibilities

- source/share expiry execution
- burn-after-read purge execution
- upload-session expiry and orphan cleanup
- invalidation cascades that run asynchronously
- cleanup of expired live coordination data where relevant later

### Allowed Dependencies

- source-item lifecycle
- sharing and delivery
- live transfer coordination
- storage cleanup adapters

### Must Not Own

- user-facing business rules as job-only logic
- projection truth

### Sequencing Position

- Phase 7 write-side stability

## 12. History, Search, And Projection Domain

### Owned Objects

- `ActiveTimelineItemProjection`
- `HistoryEntryProjection`
- `SearchDocumentProjection`
- `LiveTransferRecordProjection`
- projector or outbox-consumer state

### Responsibilities

- project write-side outcomes into active timeline
- project retained history and consumed-share representation
- project narrow trusted-device search
- project retained live-transfer records when policy allows

### Allowed Dependencies

- write-side events from source-item lifecycle
- write-side events from sharing and delivery
- retrieval completion outcomes where needed
- live-transfer retained-record publication outcomes

### Must Not Own

- lifecycle truth
- access truth
- admin content inspection

### Sequencing Position

- Phase 8 read-models

## 13. Admin Control-Plane Domain

### Owned Objects

- admin workflow orchestration state
- admin action attribution metadata

### Responsibilities

- invite management surface and actions
- pending-user approval and removal actions
- disable and re-enable user actions
- policy edit, validate, publish, and restore-defaults actions
- operational visibility for storage and cleanup health

### Allowed Dependencies

- identity, admission, and session
- confidentiality policy engine
- operational aggregates from lifecycle and storage subsystems

### Must Not Own

- direct content decryption paths
- share/source lifecycle rules
- retrieval authorization

### Sequencing Position

- Phase 11 control-plane completion

## 14. Live Transfer Coordination Domain

### Owned Objects

- `LiveTransferSession`
- transport substate
- retained live-transfer record publication decisions

### Responsibilities

- create, join, and confirm live sessions
- enforce live-session state machine
- coordinate p2p and relay attempts
- trigger explicit live-to-stored handoff when allowed
- publish retained live-transfer record outcomes when policy allows

### Allowed Dependencies

- identity
- trusted-device state
- confidentiality policy engine
- realtime/relay role
- source-item lifecycle only through explicit fallback handoff

### Must Not Own

- stored-transfer lifecycle truth
- share/source activation state

### Sequencing Position

- Phase 12 late subsystem

## 15. Recommended Dependency Direction

The safe dependency direction is:

- identity is foundational
- trusted-device depends on identity
- policy engine is consumed by many domains but owns no lifecycle state
- access substrate depends on identity, trust, and policy outputs
- source-item lifecycle depends on identity, trust, policy, access substrate, and storage adapters
- sharing and delivery depends on source-item lifecycle, identity, policy, access substrate, and recipient public-material state
- retrieval depends on source-item lifecycle, sharing and delivery, access substrate, identity, and trust
- projections depend on write-side outcomes, never the reverse
- admin depends on identity, policy, and operational aggregates without bypassing those domains
- live transfer depends on identity, trust, policy, and explicit fallback into stored transfer rather than sharing one lifecycle engine

## 16. Easy-To-Violate Boundaries

### 16.1 Session Versus Trust

- protected routes must never treat authenticated session as trusted-device authority

### 16.2 SourceItem Versus ShareObject

- share objects must not collapse into flags or columns on source items

### 16.3 Policy Engine Scattering

- policy decisions must not fragment into ad hoc boolean checks in unrelated handlers

### 16.4 AccessGrantSet Inference

- snapshot access must not be inferred from the current trusted-device list at request time

### 16.5 Retrieval Versus Storage URL

- raw storage URLs must not become the real authorization model for protected flows

### 16.6 Read Models Versus Write Truth

- timeline/history/search projections must not become the source of lifecycle or access truth

### 16.7 Admin Versus Business Ownership

- admin handlers must not bypass the actual business-owner domains of identity, policy, source, share, or retrieval state

### 16.8 Live Transfer Versus Stored Transfer

- live transfer must not merge into the stored-transfer lifecycle engine

## 17. Suggested Internal Service Seams For A v1 Monolith

If `v1` uses one main backend deployment, the safest internal service seams are:

- `identity`
- `trust`
- `policy`
- `access`
- `source`
- `retrieval`
- `sharing`
- `jobs`
- `projections`
- `admin`
- `live_transfer`

Supporting infrastructure seams may include:

- `storage_metadata_repo`
- `object_storage`
- `outbox`
- `projector`
- `realtime_relay`
- `audit_attribution`

## 18. Sequencing Alignment Summary

- Phase 1: identity, admission, and session
- Phase 2: trusted-device and recovery
- Phase 3: access substrate and package management
- Phase 4: minimal policy engine
- Phase 5: source-item lifecycle and upload coordination
- Phase 6: retrieval protocol for self retrieval
- Phase 7: lifecycle jobs and cleanup
- Phase 8: history, search, and projection
- Phase 9: sharing and delivery
- Phase 10: full retrieval accounting across delivery modes
- Phase 11: admin control plane
- Phase 12: live transfer coordination
- Phase 13: resilience and maintenance refinements

## 19. Review Rule

Every time the implementation plan is broken into code milestones, the plan should re-check:

- whether module boundaries are still visible in code ownership
- whether convenience exceptions are starting to weaken protected-flow assumptions
- whether admin workflows are bypassing business owners
- whether read-models are being treated as authoritative truth
