# Liminalis Core Domain Model

## Status

- Accepted core-domain-model draft

## Purpose

This document defines the main domain objects for `Liminalis` v1, the relationships between them, and which structures should be treated as core business objects versus derived read models.

It is intentionally above database-schema detail. Its purpose is to stabilize the architectural meaning of the system before implementation.

## Modeling Principles

- `source item` is the center of the stored-transfer domain
- `share object` is distinct from `source item` and retains its own lifecycle state
- `trusted device` is a first-class object in the security model
- `active timeline` and `history` are read models rather than primary domain objects
- confidentiality levels are not just labels; they resolve through explicit policy bundles

## Core Domain Objects

### 1. User

Represents an instance-level account identity.

Responsibilities:

- account existence
- invite and approval relationship
- enabled or disabled state
- admin versus non-admin role

Boundary:

- identifies who the user is
- does not by itself represent trusted-device decryption access

### 2. TrustedDevice

Represents a trusted browser instance belonging to a user.

Responsibilities:

- device identity within the trusted-device model
- trusted or untrusted state
- device metadata such as name and activity state
- device-level access to protected content

Boundary:

- distinct from account identity
- distinct from a login session

### 3. RecoveryCredentialSet

Represents the currently valid recovery-code set for a user.

Responsibilities:

- recovery credential version
- generation and rotation lifecycle
- recovery usage semantics

Boundary:

- not just a UI convenience
- part of the trusted-device recovery model

### 4. SourceItem

Represents a source object in the user's own stored-transfer space.

Possible content classes:

- text
- single file
- grouped file object or folder-like object

Responsibilities:

- ownership by user
- confidentiality level association
- retention and validity state
- self-space presence
- optional burn-after-read attachment
- basis for future outward share creation

Boundary:

- source-item lifecycle is independent from outward share lifecycle
- in `v1`, text source items remain in self-space only and do not produce outward-share or live-transfer objects

### 5. ShareObject

Represents one outward-delivery object derived from a source item.

Responsibilities:

- outward delivery state
- share-specific validity and revocation state
- source linkage
- recipient-targeted or delivery-mode-specific lifecycle

Boundary:

- distinct from the source item
- retains its own policy and lifecycle state while still obeying source invalidation constraints
- applies only to outward delivery modes for file-oriented content in `v1`

### 6. ExtractionAccess

Represents password-based access to a share object.

Responsibilities:

- extraction credential state
- password policy outcome
- retrieval-count tracking
- failed-attempt state and captcha escalation

Boundary:

- subordinate to outward delivery, but distinct enough to justify its own lifecycle logic

### 7. PublicLink

Represents one tracked public-link delivery object.

Responsibilities:

- link identity
- validity and revocation
- download-count tracking
- direct-download access state

Boundary:

- distinct from user-targeted and password-based access
- explicitly tracked as its own managed object

### 8. LiveTransferSession

Represents a temporary live-transfer session.

Responsibilities:

- session creation and join state
- participant confirmation
- transport-mode state
- timeout and expiry
- optional record retention

Boundary:

- separate from stored-transfer and outward-share domain lifecycles

### 9. PolicyBundle

Represents the resolved strategy bundle for one fixed confidentiality level.

Responsibilities:

- level-specific defaults
- level-specific upper bounds
- level-specific permission checks

Boundary:

- not just a label
- a real policy object interpreted by the confidentiality-policy layer

### 10. AccessGrantSet

Represents the current object-level visibility and access grant outcome for protected content.

Responsibilities:

- record whether access is effectively account-wide across trusted devices or limited to a narrower trusted-device set
- carry policy-shaped visibility results for source items and share objects
- allow recovery and new-device behavior to be modeled without collapsing access to plain account ownership

Boundary:

- derived from identity, trusted-device state, and confidentiality-policy evaluation
- can differ between a source item and its derived share objects
- should remain a focused object-level access structure for `v1`, not a generalized ACL framework

## Non-Core Read Models

### ActiveTimelineItem

- should be treated as a read model built from underlying source/share state
- should not become a primary business object

### HistoryEntry

- should be treated as a retained read model or query view
- should not replace the underlying source/share/live objects as the true business state holders
- although modeled as a read model, history remains a first-class product surface rather than an incidental debug or audit view

## Recommended Relationship Shape

- one `User` has many `TrustedDevice`
- one `User` has one current `RecoveryCredentialSet`
- one `User` owns many `SourceItem`
- one `SourceItem` has one current `AccessGrantSet`
- one `SourceItem` may generate many `ShareObject`
- one `ShareObject` has one current `AccessGrantSet`
- one `ShareObject` may expose one `ExtractionAccess`
- one `ShareObject` may expose multiple independently tracked `PublicLink` objects
- one `LiveTransferSession` references participating users and trusted devices without becoming a source item or share object
- one confidentiality level resolves through one current `PolicyBundle`

## Recommended Outward-Delivery Shape

For `v1`, outward delivery should conceptually follow:

- `SourceItem -> ShareObject -> (recipient-targeted delivery | ExtractionAccess | PublicLink)`

This preserves a unified outward-share domain while still allowing different delivery modes.

Single-recipient constraints apply only to user-targeted sharing. Password extraction and public links remain non-identity-bound delivery modes.

The one-to-many public-link model should be preserved architecturally, but `v1` does not need to optimize for heavy multi-link management workflows.

## Modeling Guidance

- do not collapse `ShareObject` into a permission flag on `SourceItem`
- do not collapse `TrustedDevice` into a plain session concept
- do not make timeline or history objects the true source of business state
- do not scatter confidentiality meaning across modules without a recognizable `PolicyBundle` concept
