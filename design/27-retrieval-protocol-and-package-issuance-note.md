# Liminalis Retrieval Protocol And Package Issuance Note

## Status

- Detailed implementation-planning note

## Purpose

This document turns the accepted retrieval semantics into a protocol-level planning note for `Liminalis` `v1`.

Its goal is to define how retrieval attempts are created, how package references are issued, how protected completion is confirmed, how retries reconcile, and how the public-link exception uses short-lived delivery tickets without weakening the protected-flow model.

This note builds on:

- `design/17-key-and-access-architecture-note.md`
- `design/19-access-grant-set-structure-and-update-rules.md`
- `design/20-retrieval-repeat-download-and-burn-after-read-semantics.md`
- `design/25-upload-storage-chunking-and-grouped-content-note.md`

## 1. Planning Goals

- define one protocol shape for all retrieval-attempt issuance
- keep authorization, package issuance, and completion accounting distinct
- make retry handling explicit and idempotent
- define public-link delivery through short-lived server-issued delivery tickets
- define the package-reference model consumed by retrieval without exposing raw root material

## 2. Retrieval Protocol Families

`v1` should distinguish four protocol families:

- ordinary protected retrieval for `SourceItem`
- ordinary protected retrieval for `ShareObject`
- password-extraction retrieval through `ExtractionAccess`
- public-link retrieval through `PublicLink`

## 3. RetrievalAttempt Record

Each server-recognized retrieval should use one `RetrievalAttempt` record.

### 3.1 Required Fields

At minimum, a retrieval-attempt record should include:

- `retrieval_attempt_id`
- `retrieval_family`
- `target_object_type`
- `target_object_id`
- `requesting_user_id` when identity-bound
- `requesting_device_id` when trusted-device-bound
- `parent_share_id` when the retrieval path depends on a share
- `delivery_object_id` for `ExtractionAccess` or `PublicLink` when applicable
- `status`: `issued`, `in_progress`, `completed`, `abandoned`, or `failed`
- `issued_at`
- `completed_at` when successful
- `attempt_scope_key` or equivalent reconciliation key
- `package_reference_id` or delivery-ticket reference when issued

### 3.2 Why The Attempt Record Exists

- it decouples success accounting from raw HTTP request starts
- it supports retry-safe idempotency
- it provides one durable anchor for later burn-after-read and no-repeat consumption logic

## 4. Attempt Scope And Reconciliation

### 4.1 Scope Rule

- one user-intended retrieval action for one retrieval path should create one retrieval-attempt identity

### 4.2 Retry Rule

- reconnects, resumed downloads, or browser retries for the same user-intended retrieval should reconcile to the same attempt where possible

### 4.3 New Attempt Rule

- a second user click after a prior attempt is already completed or abandoned may create a new attempt only if the object still remains eligible for retrieval

## 5. Package Reference Model

The retrieval protocol should not issue raw trust roots or raw content keys directly.

Instead it should issue a package reference model.

### 5.1 PackageReference

At minimum, a package reference should capture:

- `package_reference_id`
- `package_family_type`
- target protected object id
- issue-time package family version
- eligible subject context
- storage or payload reference for the wrapped package blob
- validity window or one-time-use semantics when applicable

### 5.2 Package Family Types

`v1` should support these logical package family types:

- `owner_domain_package`
- `owner_device_snapshot_package`
- `recovery_escrow_package`
- `recipient_domain_package`
- `recipient_device_snapshot_package`
- `password_extraction_package`
- `public_link_delivery_ticket`

## 6. Protected Retrieval Protocol Shape

For ordinary protected retrieval of a `SourceItem` or `ShareObject`, the protocol should conceptually run as follows:

1. create or resume a `RetrievalAttempt`
2. validate lifecycle eligibility
3. load the current `AccessGrantSet`
4. resolve the eligible package family for the requesting user and device
5. issue a `PackageReference`
6. allow ciphertext transfer using finalized storage references
7. require client confirmation of usable decryption
8. mark the attempt `completed` only after confirmation

## 7. SourceItem Ordinary Retrieval

When retrieving a `SourceItem` through the ordinary owner path:

- the backend should resolve the current owner package family through `AccessGrantSet`
- the package reference must correspond to either `owner_domain_package` or `owner_device_snapshot_package`
- recovery package issuance should not occur unless the retrieval is explicitly a recovery-restoration path

## 8. ShareObject Ordinary Retrieval

When retrieving a `ShareObject` through the ordinary recipient path:

- the backend should resolve the current recipient package family through `AccessGrantSet`
- the package reference must correspond to either `recipient_domain_package` or `recipient_device_snapshot_package`
- no-repeat or burn-after-read outcomes are applied only after successful completion rules are satisfied

## 9. Recovery Retrieval Path

When retrieval follows an allowed recovery-restoration path:

- the backend should resolve the current recovery escrow package family rather than the ordinary package family
- recovery retrieval remains subject to object lifecycle state, but not to ordinary new-device visibility limits when recovery restoration is allowed

## 10. Password Extraction Retrieval Protocol

For `ExtractionAccess`, the protocol should run as follows:

1. create or resume a `RetrievalAttempt`
2. validate extraction lifecycle state
3. validate password challenge rules
4. validate remaining retrieval count
5. issue a `password_extraction_package` reference tied to the extraction object
6. allow ciphertext transfer using the parent share's finalized storage references
7. require client confirmation of usable decryption
8. mark the attempt `completed` and decrement extraction retrieval count only after confirmation

Planning rule:

- the password-extraction path consumes extraction count, not share-object repeat-download allowance

## 11. Public-Link Retrieval Protocol

Public-link retrieval remains the explicit convenience exception.

### 11.1 Final Delivery Mechanism

`v1` should use this final delivery mechanism:

- the application validates the `PublicLink`
- the application issues a short-lived `public_link_delivery_ticket`
- the client then uses that ticket to fetch the encrypted payload from a short-lived delivery URL or equivalent object-storage-bound delivery reference

### 11.2 Why This Mechanism Is Chosen

- it preserves revoke and expiry control better than long-lived direct object links
- it avoids forcing the main application to proxy the full payload stream in every case
- it keeps public-link delivery separate from protected identity-bound package issuance

### 11.3 Public-Link Completion Rule

- one successful response-stream completion consumes one public-link download unit
- failed or abandoned delivery-ticket usage should not consume count by itself

## 12. Ciphertext Delivery Rule

- finalized ciphertext storage references should come from the stored-transfer domain
- the retrieval protocol issues package references or delivery tickets, not ad hoc content discovery
- package issuance and storage lookup must remain coordinated, but conceptually distinct

## 13. Protected Completion Confirmation

Protected retrieval should use an explicit client completion confirmation step.

### 13.1 Confirmation Meaning

- the client signals that the payload finished transferring and produced usable decryption for that retrieval attempt

### 13.2 Confirmation Requirements

At minimum, confirmation should bind:

- `retrieval_attempt_id`
- confirmation time
- client success outcome
- requesting device context

### 13.3 Server Rule

- only the first valid success confirmation for one active attempt may mark it `completed`

## 14. Failure And Abandonment Rules

### 14.1 Failure

- an attempt becomes `failed` when the protocol can no longer continue because of validation failure, delivery failure, or explicit terminal error

### 14.2 Abandonment

- an attempt becomes `abandoned` when transfer or confirmation never completes within the allowed operational window

### 14.3 Accounting Rule

- `failed` and `abandoned` attempts do not consume counts by themselves

## 15. Burn-After-Read And No-Repeat Hooks

The retrieval protocol should expose explicit completion hooks for:

- no-repeat share consumption
- burn-after-read trigger evaluation
- extraction retrieval-count decrement
- public-link download-count decrement

Planning rule:

- these are downstream consequences of successful attempt completion, not alternate definitions of completion itself

## 16. Access-Package Metadata And Versioning

Each issued package family should have stable metadata sufficient for retrieval resolution.

At minimum, package-family metadata should preserve:

- owning object id
- package family type
- current version marker
- subject scope
- wrapped payload storage reference
- replaced-by version when superseded

## 17. Regrant And Package Reissue Rule

If a later explicit regrant action is introduced:

- it should create a new package family version
- it should update the current `AccessGrantSet` version where ordinary access semantics changed
- old package family references should become superseded rather than implicitly overwritten

If recovery-maintenance actions reissue recovery package material:

- recovery package family versions should rotate independently from ordinary package family versions where possible

## 18. Recipient Wrapping Reference Rule

- recipient-domain package references should depend on recipient-published public wrapping material
- recipient-device-snapshot package references should depend on explicitly granted recipient device public identities
- the retrieval protocol should issue only the package references valid for the resolved subject path; it must not improvise a fallback subject scope at request time

## 19. Public-Link Ticket Constraints

`public_link_delivery_ticket` should be:

- short-lived
- bound to one public-link object and one delivery attempt
- revocable by ordinary public-link invalidation
- unusable once the parent public link becomes exhausted, revoked, or expired

## 20. Security Red Lines

Implementation planning should not allow these shortcuts:

- do not issue raw user-domain root material through retrieval APIs
- do not treat raw storage URLs as the sole retrieval authorization mechanism for protected flows
- do not mark protected retrieval complete before client-confirmed usable decryption
- do not let retries accidentally create duplicate completion accounting for one intended retrieval
- do not turn public-link direct delivery into a long-lived unmanaged object-storage URL
- do not silently widen recipient or device scope when resolving package references

## 21. Follow-Up Planning Needed

The next planning work should still define:

- the exact API contracts for attempt creation, package issuance, completion confirmation, and public-link ticket redemption
- the exact storage model for package blobs and delivery-ticket metadata
- the read-model note that reflects attempt outcomes into retrievability status fields
- the implementation sequencing note that places retrieval protocol after stored-transfer and access foundations
