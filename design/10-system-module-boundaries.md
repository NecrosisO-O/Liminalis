# Liminalis System Module Boundaries

## Status

- Accepted system-module boundary draft

## Purpose

This document defines the main architectural modules for `Liminalis` v1, their responsibilities, and the intended dependency directions between them.

These are logical architecture modules, not mandatory deployment units.

## Main Modules

### 1. Identity And Admission

Responsibilities:

- login and account identity
- invite-code registration
- pending approval state
- user enable and disable state
- instance-user membership and basic identity metadata

Boundary notes:

- this module answers who a user is and whether the user may enter the instance
- it does not manage trusted-device decryption access by itself

### 2. Trusted Device And Recovery

Responsibilities:

- first trusted-device establishment
- untrusted device onboarding
- QR pairing and short-code fallback
- recovery-code generation, rotation, and recovery
- trusted-device list and status
- recent activity and trusted-device metadata
- trusted-device public wrapping material publication

Boundary notes:

- this module answers whether a browser instance is trusted to access protected content
- it depends on account identity, but remains distinct from account admission

### 3. Source Item Lifecycle

Responsibilities:

- self-space text, file, and grouped-file objects
- upload-session preparation, finalization, and activation boundary
- upload-time object creation
- source-item retention and validity
- source-item confidentiality state
- source-item invalidation and deletion
- burn-after-read handling when applied to source items

Boundary notes:

- source items are a first-class domain object
- source-item lifecycle is separate from outward share lifecycle

### 4. Sharing And Delivery

Responsibilities:

- user-targeted sharing
- password-extraction sharing
- public-link delivery
- share-object creation from source items
- retrieval package issuance for outward-delivery paths
- public-link delivery-ticket issuance
- share validity, revocation, and retrieval rules
- source/share linkage and propagation of source invalidation

Boundary notes:

- this is one module with multiple outward-delivery modes inside it
- it should not be split into unrelated share systems in `v1`

### 5. Live Transfer Session

Responsibilities:

- create and join live-transfer sessions
- participant confirmation
- peer-to-peer and relay session handling
- timeout and expiry behavior
- live-transfer status and fallback handoff behavior
- optional live-transfer record retention

Boundary notes:

- this module is a distinct subsystem
- it should not be merged into the stored-transfer lifecycle core

### 6. Confidentiality Policy Engine

Responsibilities:

- interpret the three fixed confidentiality strategy bundles
- evaluate per-level permissions, defaults, and upper bounds
- answer policy questions for uploads, shares, retrieval, public links, and live transfer

Boundary notes:

- this module is a cross-cutting policy layer
- policy execution should not be scattered across unrelated modules
- it computes policy outcomes but does not own the lifecycle of source-item or share-item access-grant state directly

### 7. History And Lookup

Responsibilities:

- active-timeline query model
- detailed-history query model
- trusted-device search behavior
- trusted-device search over item titles and visible metadata
- retention-aware visibility of active versus historical records
- retained live-transfer record query model when policy allows retention

Boundary notes:

- active timeline and detailed history share the same underlying object and event source
- this module is the read-model boundary rather than a second content system
- `v1` search should emphasize titles and visible metadata rather than full-text expansion into protected content bodies by default
- `v1` search should be implemented as a narrow explicit projection rather than ad hoc query stitching across live business tables

### 8. Instance Administration

Responsibilities:

- user and approval management
- invite-code management
- storage limits and instance-level resource control
- instance-level feature switches
- confidentiality-policy configuration surface
- confidentiality-policy validation, publication, and version visibility
- system-state and health visibility

Boundary notes:

- this is a control-plane module, not a content-reading module
- it must preserve the boundary that admins cannot decrypt user content on the users' behalf
- it issues control-plane management actions, while identity and admission remains the business owner of user-state transitions

## Dependency Direction

Recommended high-level dependency shape:

- identity and admission provides account identity and membership state to other modules
- trusted device and recovery depends on identity and admission
- confidentiality policy engine is consumed by source item lifecycle, sharing and delivery, live transfer session, and instance administration
- source item lifecycle depends on identity, trusted-device state, and confidentiality policy
- sharing and delivery depends on source item lifecycle, identity, and confidentiality policy
- live transfer session depends on identity and confidentiality policy, but remains separate from stored-transfer lifecycle
- history and lookup depends on the records produced by source item lifecycle, sharing and delivery, and live transfer session
- instance administration depends on identity, policy configuration, storage state, and system-state inputs, without depending on content decryption
- source item lifecycle owns source-item access-grant state
- sharing and delivery owns share-object access-grant state

## Deployment Guidance For v1

- these module boundaries do not imply microservice boundaries
- `v1` may keep most modules inside one primary application service
- live transfer session handling should still be treated as a distinct subsystem even if it shares a deployment unit with the main backend initially

## Anti-Patterns To Avoid

- splitting modules by page rather than by stable domain responsibility
- merging live transfer into the same state machine as stored transfer
- treating public links, password extraction, and user-targeted sharing as unrelated systems
- scattering confidentiality policy decisions throughout unrelated modules
- making history a purely front-end assembled view instead of a real read-model boundary
- letting admin control-plane views drift into user-content reading surfaces
