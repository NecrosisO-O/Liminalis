# Liminalis Retrieval, Repeat-Download, And Burn-After-Read Semantics

## Status

- Detailed implementation-planning note

## Purpose

This document defines the retrieval semantics for `Liminalis` `v1`, especially the boundary between a retrieval attempt, a successful retrieval, repeat-download behavior, count consumption, and burn-after-read triggering.

Its goal is to remove ambiguity before implementation in the parts of the system where lifecycle, access, counters, retry behavior, and user-facing download expectations intersect.

This note builds on:

- `design/17-key-and-access-architecture-note.md`
- `design/18-trusted-device-pairing-and-recovery-protocol-note.md`
- `design/19-access-grant-set-structure-and-update-rules.md`

## 1. Planning Goals

- define one stable retrieval-attempt model across protected retrieval paths
- separate access authorization from retrieval accounting
- make retry behavior idempotent enough for browser reality
- make repeat-download semantics explicit for user-targeted sharing
- define how password-extraction and public-link counters are consumed
- define burn-after-read precedence over ordinary retrieval expectations
- keep purge behavior and logical unavailability distinct from physical cleanup timing

## 2. Retrieval Surfaces In `v1`

This note covers four retrieval families.

### 2.1 Self Protected Retrieval

- owner trusted-device retrieval of a `SourceItem`

### 2.2 User-Targeted Share Retrieval

- recipient trusted-device retrieval of a `ShareObject`

### 2.3 Password Extraction Retrieval

- password-based retrieval through `ExtractionAccess`

### 2.4 Public-Link Retrieval

- bearer-style convenience retrieval through `PublicLink`

## 3. Core Terms

### 3.1 Retrieval Attempt

- A single server-recognized attempt to retrieve one protected object or delivery object.
- Identified by an explicit retrieval-attempt identity.
- Exists so retries, reconnects, and completion handling are not tied only to raw HTTP request starts.

### 3.2 Retrieval Completion

- The point at which the transfer path has completed enough for the system to consider the attempt a successful delivery event.
- The exact completion rule differs between protected retrieval and public-link retrieval.

### 3.3 Successful Retrieval

- A retrieval attempt that reaches the completion rule for its retrieval family.
- A successful retrieval may consume counts, trigger no-repeat exhaustion, or trigger burn-after-read.

### 3.4 Logical Unavailability

- The point at which the object must no longer be retrievable through normal product behavior.
- This can happen immediately even if physical cleanup runs later.

## 4. Retrieval-Attempt Model

`v1` should use an explicit retrieval-attempt model across all retrieval families.

### 4.1 Attempt Lifecycle

Each retrieval attempt may move through a minimal internal lifecycle:

- `issued`
- `in_progress`
- `completed`
- `abandoned`
- `failed`

### 4.2 Attempt Purpose

The retrieval-attempt object exists to support:

- idempotent retries
- consistent success accounting
- safe count consumption
- later burn-after-read triggering

### 4.3 Attempt Scope Rule

- one user action to fetch one object path should produce one retrieval-attempt identity
- transport retries for the same intended retrieval should reuse or reconcile with that same attempt when possible

## 5. Success Rules By Retrieval Family

### 5.1 Protected Retrieval Success Rule

Protected retrieval applies to:

- self trusted-device retrieval of a `SourceItem`
- recipient trusted-device retrieval of a `ShareObject`
- password extraction once the extraction path has legitimately yielded the share access package

Protected retrieval should count as successful only after:

1. the payload transfer completes, and
2. the client confirms usable decryption for that retrieval attempt

Reason:

- protected retrieval is not just byte delivery; the product promise depends on the client actually obtaining usable protected content

### 5.2 Public-Link Success Rule

Public-link retrieval should count as successful on successful completion of the response stream.

Reason:

- public-link delivery is the explicit convenience exception path
- it should not require a protected client-confirmed decryption handshake to count as consumed

## 6. Authorization Before Retrieval

Retrieval authorization should conceptually happen before attempt consumption.

### 6.1 Protected Retrieval Gate

For protected retrieval:

1. check object lifecycle state
2. check current `AccessGrantSet`
3. check trusted-device eligibility for the requested path
4. issue the correct wrapped package family
5. start retrieval-attempt accounting

### 6.2 Extraction Retrieval Gate

For `ExtractionAccess`:

1. check extraction lifecycle state
2. check password challenge rules
3. check retrieval-count availability
4. authorize the extraction path to the parent share package
5. start retrieval-attempt accounting

### 6.3 Public-Link Retrieval Gate

For `PublicLink`:

1. check public-link lifecycle state
2. check validity and remaining download allowance
3. authorize the response path
4. start retrieval-attempt accounting

## 7. Repeat-Download Semantics For User-Targeted Sharing

### 7.1 Scope Rule

For ordinary user-targeted sharing, repeat-download is scoped to the `ShareObject` and the recipient access domain as a whole, not per device.

Planning consequence:

- repeat-download allowance is not tracked separately for each recipient device
- multiple recipient devices participate in the same share-level retrieval semantics

### 7.2 `allow-repeat-download = yes`

When repeat download is allowed:

- multiple successful retrievals may occur during the share's valid lifetime
- those successful retrievals may originate from different trusted recipient devices when recipient multi-device access is allowed
- retrieval success still remains subject to lifecycle validity, revocation, source invalidation, and burn-after-read override

### 7.3 `allow-repeat-download = no`

When repeat download is not allowed:

- the first successful retrieval consumes the share for the whole recipient access domain
- the share becomes logically unavailable for later ordinary retrieval even if it remains within its original validity window
- this consumption is not device-local; another recipient device does not get a fresh independent retrieval

## 8. Share Consumption Rule For No-Repeat Sharing

The accepted `v1` behavior for user-targeted shares with `allow-repeat-download = no` is:

- the first successful retrieval consumes the whole share object for ordinary recipient retrieval

### 8.1 Why This Rule Exists

- it matches the accepted domain-scoped retrieval interpretation
- it avoids conflicting per-device semantics
- it stays consistent with revocation and burn-after-read being share-level concepts rather than single-device quirks

### 8.2 State Consequence

- this consumed behavior should be treated as a real retrieval outcome in later state-model refinement
- it should not be faked as `revoked`, `expired`, or `source_invalidated`

### 8.3 Planning Note

- the current accepted state-model document does not yet contain a dedicated consumed-like share outcome
- a later planning update should add that rule explicitly rather than overloading existing inactive reasons

## 9. Password-Extraction Count Semantics

### 9.1 Counter Scope

- retrieval count belongs to `ExtractionAccess`
- the count is not per browser tab, not per network request, and not per device

### 9.2 Success Consumption Rule

- one successful password-extraction retrieval consumes exactly one retrieval count unit
- a failed password attempt does not consume retrieval count, but may trigger challenge escalation

### 9.3 Exhaustion Rule

- when the configured count is fully consumed, `ExtractionAccess` moves to `exhausted`

### 9.4 Parent Dependency Rule

- if the parent `ShareObject` becomes revoked, expired, source-invalidated, or enters burn-after-read purge, `ExtractionAccess` becomes invalidated even if count remains
- ordinary no-repeat consumption of the recipient-targeted retrieval path does not by itself invalidate sibling `ExtractionAccess` objects

## 10. Public-Link Download Count Semantics

### 10.1 Counter Scope

- download count belongs to one `PublicLink`
- count is not shared across sibling public links derived from the same share object

### 10.2 Success Consumption Rule

- one successful public-link response-stream completion consumes exactly one download count unit

### 10.3 Exhaustion Rule

- when the configured download count is fully consumed, that `PublicLink` moves to `exhausted`

### 10.4 Parent Dependency Rule

- if the parent `ShareObject` becomes revoked, expired, source-invalidated, or enters burn-after-read purge, `PublicLink` becomes invalidated even if download count remains
- ordinary no-repeat consumption of the recipient-targeted retrieval path does not by itself invalidate sibling `PublicLink` objects

## 11. Burn-After-Read Precedence

Burn-after-read is a higher-precedence rule than ordinary repeat-download expectations.

### 11.1 General Rule

- if burn-after-read is enabled for the relevant object, the first successful retrieval event that satisfies the burn trigger makes the object logically unavailable immediately

### 11.2 Override Rule

Burn-after-read overrides:

- user-targeted repeat-download allowance
- recipient multi-device re-access expectations
- ordinary self multi-device future retrieval expectations

### 11.3 UI Rule

- if burn-after-read is enabled, the product should not continue implying ordinary repeat-download behavior after the first successful retrieval

## 12. Burn Trigger Rules By Object Type

### 12.1 Source Item Files

- for file-like `SourceItem` retrieval, burn-after-read triggers on the first successful protected retrieval completion for that object

### 12.2 Share Object Files

- for file-like `ShareObject` retrieval, burn-after-read triggers on the first successful protected retrieval completion for that share object

### 12.3 Text Items

- for text items, burn-after-read may use an explicit read-confirmation event rather than file decryption completion

### 12.4 Derived Delivery Objects

- if a parent share enters the burn-after-read purge path or otherwise becomes logically unavailable through burn triggering, derived `ExtractionAccess` and `PublicLink` objects become logically unavailable as well

## 13. Self-Space Burn-After-Read Consequences

For self-space uploads with burn-after-read enabled:

- the first successful protected retrieval may remove online availability for the user's other devices
- this behavior is object-wide, not merely current-device-local
- local plaintext or exported copies that already exist remain outside system control

## 14. Retry And Idempotency Rules

### 14.1 Retry Principle

- repeated network or browser retries for the same intended retrieval should not double-consume counts merely because multiple transport requests occurred

### 14.2 Protected Retrieval Rule

- only one successful completion may be recorded for one retrieval-attempt identity
- retries before successful completion should reconcile to that same attempt where possible

### 14.3 Public-Link Rule

- repeated public-link request starts should not double-consume download count unless more than one attempt reaches the success rule

### 14.4 Failure Rule

- abandoned or failed attempts should not consume retrieval count or download count by themselves

## 15. Logical Unavailability Versus Physical Cleanup

These two moments must remain distinct.

### 15.1 Logical Unavailability

- happens immediately when a burn trigger fires, a no-repeat share is consumed, or a relevant lifecycle invalidation occurs
- blocks further retrieval immediately

### 15.2 Physical Cleanup

- may happen asynchronously through purge and cleanup work
- may lag behind logical unavailability without weakening user-visible access blocking

## 16. Read-Model Consequences

### 16.1 Active Timeline

- once a burn-after-read object becomes logically unavailable, it should leave the active timeline immediately from the product perspective
- once a no-repeat share is consumed, it should also stop behaving as an active retrievable share

### 16.2 Detailed History

- burn-after-read objects should not remain as retained user-visible history after purge completion
- no-repeat consumed shares need a later explicit history rule so they do not get misreported as revoked or expired

### 16.3 Search

- burn-after-read objects should not remain searchable after purge completion
- no-repeat consumed shares should follow whatever later retained-history/search rule is chosen for that consumed outcome

## 17. Generic Failure Behavior

- invalid or unavailable password extraction and public-link retrievals should fail without revealing unnecessary content detail
- retry-friendly failures should remain distinguishable internally without exposing sensitive state distinctions externally
- failed attempts may still be logged for abuse handling and diagnostics

## 18. Security Red Lines

Implementation planning should not allow these shortcuts:

- do not count raw click events as completed retrievals
- do not consume protected retrieval counters before usable decryption confirmation
- do not model repeat-download as per-device when the share is domain-scoped
- do not let burn-after-read coexist operationally with later repeated retrieval of the same object
- do not treat no-repeat share consumption as if it were sender revocation or ordinary expiry
- do not let physical purge timing control logical access blocking

## 19. Follow-Up Planning Needed

The next planning work should still define:

- the exact retrieval-attempt record fields and reconciliation rules
- the share-state refinement needed to model consumed no-repeat shares explicitly
- the metadata/history/search note that explains visibility after no-repeat consumption versus burn-after-read purge
- the API-level success-confirmation handshake for protected client decryption completion
