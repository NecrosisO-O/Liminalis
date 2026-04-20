# Liminalis AccessGrantSet Structure And Update Rules

## Status

- Detailed implementation-planning note

## Purpose

This document turns `AccessGrantSet` from an architectural concept into a concrete implementation-planning object for `Liminalis` `v1`.

Its goal is to define what an `AccessGrantSet` contains, what it does not contain, when it must be created, when it must be replaced, when it must remain unchanged, and how it interacts with trusted-device pairing, recovery, share lifecycle, and retrieval.

This note stays above database schema and API detail. It defines the logical structure, invariants, versioning model, and update triggers needed before implementation.

## 1. Planning Role

`AccessGrantSet` is the object-level access structure for protected content in `v1`.

It exists to answer one narrow question:

- which protected access path is valid for this `SourceItem` or `ShareObject` right now, and what wrapped package family should be used for that path

It exists specifically so `Liminalis` does not collapse protected access to:

- plain account ownership
- plain device-local ownership
- scattered policy checks hidden across unrelated handlers

## 2. Scope Boundary

### 2.1 Objects That Use `AccessGrantSet`

`AccessGrantSet` applies only to:

- `SourceItem`
- `ShareObject`

### 2.2 Objects That Do Not Use `AccessGrantSet`

`AccessGrantSet` does not directly model access for:

- `ExtractionAccess`
- `PublicLink`
- `LiveTransferSession`

Reason:

- `ExtractionAccess` and `PublicLink` already have their own access-state objects and lifecycles
- `LiveTransferSession` is session-local rather than stored protected-object access

## 3. Core Responsibilities

Each `AccessGrantSet` must:

- identify the protected object it belongs to
- identify the grant subject model for ordinary protected access
- identify the user or device subject referenced by that grant model
- reference the currently active ordinary wrapped access packages
- state whether recovery restoration is allowed
- reference the currently active recovery package family when present
- carry the minimal access-relevant policy snapshot needed to preserve stable behavior
- expose a version marker so later regrant operations do not mutate access semantics invisibly

## 4. Non-Responsibilities

`AccessGrantSet` must not become:

- a general-purpose ACL framework
- a read model for timeline or history presentation
- a replacement for object lifecycle state
- a place to store password-extraction counters or public-link download counters
- a substitute for trusted-device onboarding state

## 5. Versioning Model

`v1` should treat `AccessGrantSet` as a replace-on-change structure rather than a freely mutable record.

### 5.1 Logical Rule

- each protected object has one current `AccessGrantSet`
- when object-level access semantics materially change, a new `AccessGrantSet` version should be created
- the previous version becomes superseded rather than silently rewritten in place

### 5.2 Why This Rule Exists

- it keeps access changes explicit
- it avoids hidden semantic drift after policy or trust changes
- it matches the already accepted idea that a protected object has one current grant outcome, not an ad hoc bag of permissions

### 5.3 Product Boundary

- users do not need to see old `AccessGrantSet` versions in the product UI
- superseded versions exist for implementation consistency, operational reasoning, and internal auditability

## 6. Required Logical Fields

Each current `AccessGrantSet` should contain at least the following logical fields.

### 6.1 Identity Fields

- `access_grant_set_id`
- `version`
- `protected_object_type`: `source_item` or `share_object`
- `protected_object_id`
- `status`: `current` or `superseded`

### 6.2 Subject Fields

- `grant_subject_mode`, one of:
  - `owner_domain`
  - `owner_device_snapshot`
  - `recipient_domain`
  - `recipient_device_snapshot`
- `subject_user_id`
- `snapshot_device_ids` when the mode is one of the snapshot modes

### 6.3 Ordinary Access Fields

- reference to the current ordinary package family
- package-family version or issue marker
- issue trigger marker such as `source_created`, `share_created`, `device_regrant`, or another explicit regrant reason

### 6.4 Recovery Fields

- `recovery_enabled`
- reference to the current recovery package family when present
- recovery package-family version or issue marker

### 6.5 Policy Snapshot Fields

Only the access-shaping values needed for stable interpretation belong here.

At minimum this includes:

- confidentiality level at issue time
- whether newly added trusted devices may view older content for source-item access
- whether recipient multi-device access is allowed for the share
- any explicit access-limiting rule that caused snapshot mode instead of domain mode

### 6.6 Replacement Fields

- `supersedes_access_grant_set_id` when this version replaces an earlier version
- `issued_at`
- `superseded_at` when the version is no longer current

## 7. Grant Subject Modes

### 7.1 `owner_domain`

- Used for a `SourceItem` when ordinary access may follow the owner's trusted-device domain.
- Newly paired trusted devices may access the object through the ordinary owner-domain path.
- No per-object device list is needed.

### 7.2 `owner_device_snapshot`

- Used for a `SourceItem` when ordinary access must remain limited to explicitly granted trusted devices.
- Newly paired devices do not automatically inherit ordinary access.
- The current device snapshot must be stored explicitly.

### 7.3 `recipient_domain`

- Used for a `ShareObject` when ordinary access may follow the recipient's trusted-device domain.
- Newly paired recipient devices may access the share through the ordinary domain path.

### 7.4 `recipient_device_snapshot`

- Used for a `ShareObject` when ordinary access must remain limited to explicitly granted recipient devices.
- Newly paired recipient devices do not automatically inherit ordinary share access.

## 8. Core Invariants

The following rules should always hold.

### 8.1 Object Invariant

- a `SourceItem` has exactly one current `AccessGrantSet` when it is in a protected stored state
- a `ShareObject` has exactly one current `AccessGrantSet` when it exists as a valid protected share object

### 8.2 Subject Invariant

- `owner_*` modes may appear only on `SourceItem`
- `recipient_*` modes may appear only on `ShareObject`

### 8.3 Snapshot Invariant

- snapshot device sets must be explicit, not implied from current account device membership

### 8.4 Recovery Invariant

- `recovery_enabled` must reflect whether recovery restoration packages exist for that protected object
- recovery restoration is an additional restoration path, not a replacement for the ordinary grant mode

### 8.5 Lifecycle Invariant

- object lifecycle state gates retrieval before package issuance
- an active `AccessGrantSet` alone does not make an inactive or purged object retrievable

## 9. Creation Rules

### 9.1 Source Item Creation

When a protected `SourceItem` is created:

1. choose `owner_domain` or `owner_device_snapshot` from the source-item policy snapshot
2. create the current ordinary package family for that mode
3. create the recovery package family if recovery restoration is allowed
4. create the first current `AccessGrantSet`

### 9.2 Share Object Creation

When a protected `ShareObject` is created:

1. choose `recipient_domain` or `recipient_device_snapshot` from the share policy snapshot
2. create the current ordinary package family for that mode
3. create the recovery package family if recipient recovery restoration is allowed
4. create the first current `AccessGrantSet`

## 10. Retrieval Resolution Rules

When a device requests protected retrieval, access resolution should conceptually happen in this order:

1. verify the parent object is logically retrievable under lifecycle rules
2. load the current `AccessGrantSet`
3. determine whether the request is using the ordinary path or a recovery-restoration path
4. verify the requesting user and trusted device match the allowed subject model
5. select the correct current package family reference
6. issue only the package family allowed for that path

Planning consequence:

- `AccessGrantSet` chooses package families
- lifecycle chooses whether retrieval is allowed at all
- retrieval accounting remains outside `AccessGrantSet`

## 11. Update Rules: When `AccessGrantSet` Must Not Change

Many important events should not rewrite the current `AccessGrantSet`.

### 11.1 New Device Pairing Under Domain Modes

If a protected object already uses:

- `owner_domain`, or
- `recipient_domain`

then ordinary pairing of a new trusted device should not create a new `AccessGrantSet` version.

Reason:

- the domain grant model already allows newly paired devices to follow the trusted-device domain

### 11.2 Recovery Completion

Successful recovery should usually not rewrite the current `AccessGrantSet`.

Reason:

- recovery is a restoration path through the existing recovery package family, not a reinterpretation of the object's ordinary access semantics

### 11.3 Object Lifecycle Changes

These object lifecycle events should not require a new `AccessGrantSet` version:

- source item expiry
- source item user removal
- share revocation
- share expiry
- share source invalidation
- burn-after-read entry into purge path

Reason:

- lifecycle state already gates availability
- `AccessGrantSet` describes access structure, not retained-state presentation

### 11.4 Admin Policy-Bundle Edits

Changing the instance policy bundle should not retroactively rewrite existing `AccessGrantSet` versions by default.

Reason:

- the accepted planning baseline already avoids silent retroactive rewrites of existing protected objects

## 12. Update Rules: When `AccessGrantSet` Must Change

### 12.1 Snapshot-Mode Device Invalidation

If the current grant subject mode is:

- `owner_device_snapshot`, or
- `recipient_device_snapshot`

and one of the explicitly granted devices becomes invalidated or removed from trust, a new `AccessGrantSet` version must be created with an updated `snapshot_device_ids` set.

Reason:

- snapshot modes promise explicit device-bounded access, so the current snapshot cannot remain semantically correct after device removal

### 12.2 Explicit Access Regrant

If the product later exposes an explicit regrant action, such as reissuing access to the user's current trusted devices or reissuing a share to the recipient's current trusted devices, a new `AccessGrantSet` version must be created.

Reason:

- regrant changes which ordinary devices may use the protected object

### 12.3 Explicit Access-Mode Change

If a later planning note allows an explicit access-mode change such as:

- `owner_device_snapshot -> owner_domain`
- `owner_domain -> owner_device_snapshot`
- `recipient_device_snapshot -> recipient_domain`
- `recipient_domain -> recipient_device_snapshot`

then that action must create a new `AccessGrantSet` version rather than mutating the current version.

### 12.4 Recovery-Package Reissue

If recovery package material for a protected object must be reissued because of a deliberate recovery-root rotation or another explicit recovery-maintenance action, a new `AccessGrantSet` version should be created when the active recovery package family changes.

## 13. Special Rule For Source-Level Changes

Changing a source item's current confidentiality level later should not automatically rewrite the current `AccessGrantSet` in `v1`.

Reason:

- the accepted planning baseline already favors stable snapshot semantics for existing objects
- later source-level changes primarily affect future actions derived from the source item
- silent access reinterpretation would be hard to reason about and easy to implement incorrectly

Planning consequence:

- if a future product action wants to re-evaluate self-space access visibility for an existing source item, that must be modeled as an explicit regrant or access-adjustment action, not as an invisible side effect of renaming the current confidentiality label

## 14. Device-Pairing And Recovery Consequences

### 14.1 Pairing Under Domain Modes

- no `AccessGrantSet` rewrite is needed
- the newly trusted device becomes eligible through the existing domain grant path

### 14.2 Pairing Under Snapshot Modes

- no `AccessGrantSet` rewrite happens automatically
- the newly trusted device remains outside ordinary access for that object until a later explicit regrant exists

### 14.3 Recovery Under Any Mode

- recovery may succeed even when ordinary pairing would not grant historical access
- the current `AccessGrantSet` remains the same so long as the active recovery package family already supports restoration

## 15. Empty-Snapshot Handling

It is possible for a snapshot-mode `AccessGrantSet` to lose all currently valid ordinary devices after trust invalidation.

`v1` should allow this state.

Planning consequence:

- the protected object may remain logically present while ordinary access is temporarily unavailable
- recovery or an explicit regrant may restore usable access later
- this should not force object deletion or forced lifecycle invalidation by itself

## 16. Relation To Read Models

`AccessGrantSet` is not directly a timeline or history object, but it influences visibility.

### 16.1 Active Timeline

- an object may appear only if its lifecycle state is active and the requesting trusted device has an allowed path through the current `AccessGrantSet`

### 16.2 Detailed History

- retained history visibility should still respect the current access structure for protected metadata and retrieval actions
- superseded `AccessGrantSet` versions do not become user-facing history entries

### 16.3 Search

- trusted-device search should filter the retained object set through the current access outcome, not through stale superseded grant versions

## 17. Minimal Internal Status Model

For planning purposes, an `AccessGrantSet` version only needs a minimal internal status family:

- `current`
- `superseded`

It does not need a larger independent lifecycle in `v1`.

Reason:

- object lifecycle already lives on `SourceItem` and `ShareObject`
- password and link lifecycle already live on `ExtractionAccess` and `PublicLink`

## 18. Security Red Lines

Implementation planning should not allow these shortcuts:

- do not infer protected access only from account identity
- do not derive snapshot-mode access by looking at the user's current device list at request time
- do not auto-rewrite `AccessGrantSet` after ordinary pairing when the current mode is a snapshot mode
- do not treat recovery success as a reason to silently widen ordinary access semantics
- do not let lifecycle invalidation and access-grant replacement collapse into one mechanism
- do not reuse superseded grant versions when a newer current version exists

## 19. Follow-Up Planning Needed

The next planning notes should still define:

- the exact wrapped package metadata model referenced by `AccessGrantSet`
- the retrieval-attempt protocol that consumes those package references safely
- the metadata and search note that explains how current trusted-device visibility is applied in read models
- any future explicit regrant actions if the product later exposes them
