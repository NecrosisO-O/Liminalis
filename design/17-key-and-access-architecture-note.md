# Liminalis Key And Access Architecture Note

## Status

- Detailed implementation-planning note

## Purpose

This document turns the accepted key and access baseline into a more concrete implementation-planning shape for `Liminalis` `v1`.

Its goal is to make the protected-content access model specific enough to guide later implementation notes for trusted-device onboarding, recovery, sharing, retrieval, and storage without starting code.

This note is still below algorithm-selection detail. It fixes key roles, wrapping boundaries, access-package structure, and the relationship between ordinary trusted-device access, recovery, recipient access, password extraction, and the public-link exception.

## 1. Planning Goals

- preserve one protected-content model across confidentiality levels in `v1`
- keep account identity separate from decryption access
- keep source content reusable across multiple outward-delivery paths
- support policy-shaped visibility for newly added trusted devices
- support recovery without collapsing trust to plain account ownership
- keep public-link delivery outside the protected-access model
- avoid whole-file-in-memory assumptions for large files

## 2. Main Key And Access Objects

This note uses the following planning terms.

### 2.1 UserDomainAccessRoot

- A user-scoped root wrapping context for ordinary protected access inside that user's trusted-device domain.
- Generated in the browser when the first trusted device is established.
- Never stored by the server in plaintext form.
- Used to support ordinary protected access for owner-domain items and recipient-domain shares when policy allows domain-style access.

### 2.2 UserDomainAccessPublicKey

- A publishable public wrapping identity for the user's ordinary trusted-device domain.
- Generated alongside `UserDomainAccessRoot` when the first trusted device is established.
- Safe to store server-side and expose for recipient-package issuance because it does not reveal the private user-domain access root.
- Used to wrap `ShareAccessKey` for recipient-domain access without requiring server possession of recipient plaintext trust roots.

### 2.3 UserRecoveryRoot

- A user-scoped recovery wrapping context used only for recovery restoration.
- Created alongside the user's first trusted-device setup.
- Wrapped for later recovery use through the recovery-credential flow rather than through ordinary login.
- Used to restore historical protected access without turning recovery into a weaker or stronger long-term trust class.

### 2.4 DeviceIdentityKey

- A per-device identity and authorization keypair or equivalent device-specific key identity.
- Represents one trusted browser instance.
- Used for pairing, device approval, and device-bounded access packages where policy requires a narrower than domain-wide grant.

### 2.5 SourceContentKey

- A per-`SourceItem` symmetric content-encryption key.
- Encrypts the actual protected content body.
- For large files or grouped content, the content body may be chunked, but the source item still owns one logical content key hierarchy.

### 2.6 ShareAccessKey

- A per-`ShareObject` access-layer key or equivalent share-specific access package root.
- Wraps or unlocks access to the underlying `SourceContentKey` rather than replacing the source ciphertext body.
- Exists so that a share object remains a true object with its own lifecycle, policy snapshot, and downstream delivery paths.

### 2.7 ExtractionSecret

- A random per-`ExtractionAccess` secret or access package input.
- Used to protect password-extraction access separately from both owner-domain and recipient-domain access.
- Protected through password-derived wrapping rather than trusted-device identity.

### 2.8 PublicLinkDeliverySecret

- A per-`PublicLink` convenience-delivery secret or token family.
- Must remain outside the normal protected-access grant model.
- Exists to support bearer-style retrieval under explicit public-link rules.

### 2.9 AccessGrantSet

- A persisted object-level access structure attached to a `SourceItem` or `ShareObject`.
- Describes who may obtain protected access packages, under what rule family, and through which package references.
- Is not a generalized ACL system.

## 3. Core Model

### 3.1 Protected Content Layering

`v1` should use this protected layering model:

- `SourceItem` owns the protected content body and the `SourceContentKey`
- `ShareObject` adds a share-specific access layer through `ShareAccessKey`
- `ExtractionAccess` adds a password-based access layer below `ShareObject`
- `PublicLink` uses a separate convenience-delivery path rather than joining the protected layering model

Planning consequence:

- protected ciphertext bodies should be stored once where possible
- share creation should not require re-encrypting the full content body by default
- share revocation and share lifecycle should still remain independent from source-item lifecycle

### 3.2 Why `ShareAccessKey` Exists

The share layer should not directly hand out the owner's ordinary source-item access package.

`ShareAccessKey` exists to preserve these boundaries:

- `ShareObject` stays distinct from `SourceItem`
- one source item may generate many share objects with independent lifecycle state
- password extraction and public links stay subordinate to one share object rather than branching directly from the source item
- future delivery paths can remain layered without requiring full body duplication

## 4. Owner, Recipient, Recovery, And Exception Access

### 4.1 Owner Protected Access

Owner protected access covers a user's own `SourceItem` objects.

The system should support two ordinary owner-access grant modes:

- `owner_domain`: the item may follow the user's ordinary trusted-device domain
- `owner_device_snapshot`: the item is available only to the trusted devices explicitly granted at issue time

Policy mapping:

- if the current source-item policy allows newly added trusted devices to view older content, ordinary owner access may use `owner_domain`
- if the current source-item policy does not allow newly added trusted devices to view older content, ordinary owner access should use `owner_device_snapshot`

### 4.2 Recipient Protected Access

Recipient protected access covers user-targeted sharing through `ShareObject`.

The system should support two ordinary recipient-access grant modes:

- `recipient_domain`: the share may be accessed across the recipient's trusted-device domain
- `recipient_device_snapshot`: the share is available only to recipient devices explicitly granted at issue time

Policy mapping:

- if the share policy allows recipient multi-device access, ordinary recipient access may use `recipient_domain`
- if the share policy does not allow recipient multi-device access, ordinary recipient access should use `recipient_device_snapshot`

Recipient issuance rule:

- `recipient_domain` packages should wrap `ShareAccessKey` to the recipient's published `UserDomainAccessPublicKey`
- `recipient_device_snapshot` packages should wrap `ShareAccessKey` only to the explicitly granted recipient device public identities
- user-targeted sharing in `v1` should require that the recipient already has established trusted-device public wrapping material; recipient accounts that have not completed first trusted-device establishment are not yet eligible for identity-bound protected sharing

### 4.3 Recovery Access

Recovery access should not be treated as ordinary new-device expansion.

To preserve the accepted product rule that recovery restores access into the same trusted-access domain, `v1` should treat recovery as a distinct restoration path using `UserRecoveryRoot`.

Planning consequence:

- ordinary policy about whether newly added devices may view older content controls pairing-based device expansion
- recovery may still restore historical protected access through recovery escrow packages even when ordinary new-device expansion would not expose older content
- this avoids weakening recovery into a permanently restricted access tier

### 4.4 Public-Link Exception Access

`PublicLink` must not reuse owner-domain, recipient-domain, or password-extraction protected grants.

Planning consequence:

- a public link should have its own `PublicLinkDeliverySecret` and lifecycle controls
- the public-link path may reference the same underlying source ciphertext or a link-specific convenience-delivery package, but it must remain logically separate from protected access grants
- later public-link planning still needs to choose the final convenience-delivery mechanism, but that choice must not weaken the protected-flow model defined here

## 5. AccessGrantSet Shape

`AccessGrantSet` should be implemented as a focused persisted structure with clear fields rather than an implied policy result.

At minimum, each `AccessGrantSet` should capture:

- the protected object owner type: `source_item` or `share_object`
- the grant subject mode:
  - `owner_domain`
  - `owner_device_snapshot`
  - `recipient_domain`
  - `recipient_device_snapshot`
- the subject reference:
  - owner user
  - recipient user
  - explicitly granted trusted devices where applicable
- whether recovery restoration is allowed for the protected object
- references to the active wrapped access packages
- the relevant policy snapshot inputs that shape access visibility
- issue-time grant version or equivalent package versioning marker

`AccessGrantSet` should not attempt to become a general-purpose permissions framework for unrelated product surfaces.

## 6. Access Package Families

### 6.1 Owner-Domain Package

- Wraps or unlocks `SourceContentKey` for ordinary owner-domain use through `UserDomainAccessRoot`.
- Suitable when the policy allows older content to follow the user's trusted-device domain.

### 6.2 Owner Device-Snapshot Packages

- Wrap `SourceContentKey` to explicitly granted device identities.
- Suitable when ordinary future devices must not automatically gain access to older content.

### 6.3 Recovery Escrow Package

- Wraps `SourceContentKey` or `ShareAccessKey` for restoration through `UserRecoveryRoot`.
- Exists so recovery can restore historical access without depending on another active trusted device.

### 6.4 Recipient-Domain Package

- Wraps or unlocks `ShareAccessKey` for the recipient's trusted-device domain through that recipient user's published `UserDomainAccessPublicKey` and corresponding private domain root material.

### 6.5 Recipient Device-Snapshot Packages

- Wrap `ShareAccessKey` only for the recipient devices explicitly granted at issue time using those devices' public identities.

### 6.6 Password-Extraction Package

- Protects `ShareAccessKey` through a per-extraction random `ExtractionSecret`.
- The `ExtractionSecret` is then protected through password-derived wrapping and retrieval-state controls.

### 6.7 Public-Link Package

- Uses `PublicLinkDeliverySecret` and public-link-specific lifecycle controls.
- Must remain a separate package family from the protected access packages above.

## 7. Planned Object Relationships

### 7.1 Source Item Relationship

Each `SourceItem` should own:

- one `SourceContentKey`
- one current `AccessGrantSet`
- zero or more owner ordinary access packages
- zero or one recovery escrow package family for owner restoration

### 7.2 Share Object Relationship

Each `ShareObject` should own:

- one `ShareAccessKey`
- one current `AccessGrantSet`
- a protected reference to the source item's `SourceContentKey`
- zero or more recipient ordinary access packages
- zero or one recovery escrow package family for recipient restoration
- zero or one `ExtractionAccess`
- zero or more `PublicLink` objects

Planning rule:

- ordinary recipient retrieval, password extraction, and public-link delivery are sibling delivery paths under one outward-delivery root
- consuming the ordinary recipient retrieval path does not by itself invalidate already issued `ExtractionAccess` or `PublicLink` objects
- share-level revocation, expiry, source invalidation, or burn-after-read purge remain the events that close all sibling delivery paths together

### 7.3 Extraction Relationship

Each `ExtractionAccess` should own:

- one `ExtractionSecret`
- password-policy state
- retrieval-count state
- a protected reference to the parent share's `ShareAccessKey`

### 7.4 Public Link Relationship

Each `PublicLink` should own:

- one `PublicLinkDeliverySecret`
- independent validity and download-count state
- a link to the parent `ShareObject`

## 8. Key Flows

### 8.1 First Trusted Device Establishment

When the first trusted device is established:

1. the browser generates `UserDomainAccessRoot`
2. the browser derives and publishes `UserDomainAccessPublicKey`
3. the browser generates `UserRecoveryRoot`
4. the browser generates the device's `DeviceIdentityKey`
5. the server stores only public material plus wrapped or package forms needed for later trusted-device and recovery flows

Planning rule:

- raw user-scoped protected access roots must not be stored server-side in plaintext form

### 8.2 Source Item Creation

When a user creates a protected `SourceItem`:

1. the browser generates `SourceContentKey`
2. the browser encrypts the content body locally
3. the ciphertext body is uploaded or streamed to storage
4. the system creates the source item's `AccessGrantSet`
5. the system creates the owner ordinary access package family based on policy
6. the system creates the owner recovery escrow package family when recovery restoration is allowed

### 8.3 Ordinary Self Retrieval

When an eligible trusted device retrieves a source item:

1. the server checks trusted-device eligibility through `AccessGrantSet`
2. the server returns the relevant wrapped access package
3. the device unwraps the `SourceContentKey` locally
4. the device decrypts the content locally

### 8.4 New Device Pairing

When a new device is paired through an existing trusted device:

1. the new device obtains trusted-device status
2. the new device receives the user-scoped ordinary access material needed for its domain role
3. older objects become available only if their `AccessGrantSet` ordinary visibility rules allow it

Planning rule:

- pairing-based trust expansion must not silently bypass older-content visibility policy

### 8.5 Recovery Restoration

When a user restores access through recovery:

1. the recovery flow authorizes access to `UserRecoveryRoot`
2. a new trusted device is established into the same user trusted-access domain
3. historical protected objects that carry recovery escrow packages may be restored through those packages
4. the recovery credentials rotate immediately after success

Planning rule:

- recovery restoration is intentionally stronger than ordinary new-device visibility for historical protected content when needed to preserve account-level recovery semantics

### 8.6 User-Targeted Share Creation

When a user creates a `ShareObject`:

1. the system verifies that the recipient already has the public wrapping material required for the selected recipient access mode
2. the system creates `ShareAccessKey`
3. the share object stores a protected reference from `ShareAccessKey` to the source item's `SourceContentKey`
4. the system creates the share `AccessGrantSet`
5. the system creates recipient ordinary access packages according to recipient access policy using recipient-published public wrapping material
6. the system creates recipient recovery escrow packaging when recovery restoration is allowed for that user-domain share

Eligibility rule:

- if the recipient account exists but has not yet established the trusted-device public wrapping material needed for identity-bound protected sharing, `v1` should block creation of that user-targeted protected share rather than queueing a weaker hidden access path
- in that case, the product may guide the sender toward a different allowed delivery mode such as password extraction or public link when policy permits

### 8.7 Password Extraction Creation

When password extraction is created:

1. the system creates `ExtractionSecret`
2. the system wraps or unlocks `ShareAccessKey` through `ExtractionSecret`
3. the system protects `ExtractionSecret` through password-derived wrapping
4. retrieval state remains in `ExtractionAccess`, not in `ShareObject`

### 8.8 Public Link Creation

When a public link is created:

1. the system creates `PublicLinkDeliverySecret`
2. the public-link object records validity, download-count, and revocation state
3. the public-link delivery package remains separate from owner, recipient, and password-based protected grants

## 9. Storage Planning Rules

### 9.1 Metadata Database

The metadata database should hold:

- object metadata
- policy snapshots
- `AccessGrantSet` records
- wrapped access package metadata and references
- trusted-device metadata
- recovery-credential metadata
- extraction and public-link state

### 9.2 Object Storage

Object storage should hold:

- ciphertext file bodies
- chunk objects
- grouped-content member blobs and manifests where applicable

In `v1`, encrypted self-space text bodies should remain in the metadata database rather than being moved into object storage by default.

### 9.3 Plaintext Limits

The server should not store plaintext protected file bodies.

Any limited server-visible metadata permitted elsewhere in planning remains outside this document's key-access boundary and must not be confused with plaintext content-body storage.

## 10. Large-File And Grouped-Content Implications

- `SourceContentKey` remains the logical root for the source item even when the physical ciphertext body is chunked
- chunking or grouped-content packaging may derive internal working keys or manifests, but the source item still owns one logical protected access boundary
- share creation should reference the existing protected content body rather than trigger full content duplication by default

## 11. Revocation, Invalidation, And Local-Copy Boundaries

- revoking a share prevents future retrieval of that share's protected access packages
- invalidating a source item prevents future retrieval of the source item and cascades to derived shares
- consuming a no-repeat recipient delivery path closes only that ordinary recipient retrieval path and does not by itself invalidate already issued `ExtractionAccess` or `PublicLink` objects
- invalidating server-side access cannot erase already exported local plaintext copies
- once a device has already unwrapped and saved usable plaintext locally, later lifecycle changes affect only future in-product retrieval

## 12. Security Red Lines

Implementation planning should not allow these shortcuts:

- do not treat login session state as decryption authority
- do not hand recipient paths the owner's ordinary source-item access package directly
- do not collapse password extraction into user-targeted access grants
- do not collapse public links into the protected access model
- do not remove recovery as a true historical access restoration path
- do not require full-body re-encryption for ordinary share creation by default
- do not let server-side convenience exceptions redefine protected-flow trust assumptions

## 13. Follow-Up Planning Needed

This note is intentionally specific, but it still leaves some implementation-planning work for later notes.

The next detailed notes should define:

- the exact trusted-device pairing and recovery protocol messages
- the detailed field structure and lifecycle update rules for `AccessGrantSet`
- the exact retrieval-attempt protocol for protected retrieval
- the final public-link delivery mechanism inside the already accepted exception boundary
- the final algorithm families and browser capability assumptions
