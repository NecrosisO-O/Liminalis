# Liminalis Flow And State Model Refinement Note

## Status

- Detailed implementation-planning note

## Purpose

This document refines the accepted `v1` flow and state model so it remains consistent with the later implementation-planning decisions about no-repeat share consumption, burn-after-read visibility, and retained read-model behavior.

Its main goal is to close the gap between the earlier accepted state model and the newer planning decisions that now require an explicit consumed-like share outcome.

This note is a refinement of `design/12-flow-and-state-model.md`, not a replacement for the broader lifecycle model.

## 1. Why Refinement Is Needed

The accepted flow-and-state model already correctly distinguishes:

- retained inactive outcomes
- purge-path behavior for burn-after-read
- independent lifecycle logic for extraction and public links

However, later accepted planning has now added another required distinction:

- a user-targeted share with `allow-repeat-download = no` is consumed after the first successful retrieval for the recipient access domain
- this consumed outcome must not be faked as `revoked`, `expired`, or `source_invalidated`
- this consumed outcome should leave the active timeline immediately but remain in retained history and search

That means the share-state model now needs one additional explicit retained outcome.

## 2. Refinement Scope

This note refines only the parts of the state model affected by the accepted later decisions:

- `ShareObject` lifecycle
- retained history interpretation
- active timeline removal logic
- search retention interpretation
- cascades into `ExtractionAccess` and `PublicLink`

It does not redefine:

- source-item core lifecycle
- trusted-device onboarding states
- live-transfer session states
- the burn-after-read purge-path family itself

## 3. Refined Share Object Lifecycle

### 3.1 Primary States

`ShareObject` should continue using:

- `created`
- `active`
- `inactive`

This note does not require a brand-new top-level primary state.

### 3.2 Refined Inactive Reasons

`ShareObject` inactive reasons should now be:

- `revoked`
- `expired`
- `source_invalidated`
- `consumed`

### 3.3 Meaning Of `consumed`

`consumed` means:

- the share was valid and retrievable
- a successful retrieval happened under a no-repeat share rule
- the share is no longer retrievable through ordinary recipient retrieval
- the share remains a real retained historical outcome rather than a purge-path disappearance

## 4. What `consumed` Is Not

`consumed` must not be interpreted as:

- sender revocation
- normal expiry
- source invalidation
- burn-after-read purge

Reason:

- each of those means something materially different to users and to later system behavior

## 5. Refined Share Transitions

### 5.1 Existing Transitions That Stay

These transitions remain unchanged:

- `created -> active`
- `active -> inactive (revoked)`
- `active -> inactive (expired)`
- `active -> inactive (source_invalidated)`
- `active -> purge path` when burn-after-read triggers for the share object

### 5.2 New Transition

Add this transition:

- `active -> inactive (consumed)` when a no-repeat share completes its first successful retrieval for the recipient access domain

### 5.3 Rule Priority

When burn-after-read is enabled for the share object:

- burn-after-read remains higher precedence than ordinary repeat-download expectations
- the share should enter the purge path rather than retained `inactive (consumed)`

Planning consequence:

- `consumed` is for retained no-repeat share completion
- burn-after-read still uses non-retained purge semantics

## 6. Retrieval Outcome Mapping

### 6.1 Repeat-Allowed Share

If `allow-repeat-download = yes` and no burn-after-read rule fires:

- successful retrieval does not change the main share lifecycle state
- the share remains `active` while otherwise valid

### 6.2 No-Repeat Share

If `allow-repeat-download = no` and no burn-after-read rule fires:

- the first successful retrieval moves the share to `inactive (consumed)`

### 6.3 Burn-After-Read Share

If burn-after-read is enabled and the burn trigger is satisfied:

- the share enters the purge path instead of becoming `inactive (consumed)`

## 7. Read-Model Consequences Of `consumed`

### 7.1 Active Timeline

- a share in `inactive (consumed)` must not remain in the active timeline

### 7.2 Detailed History

- a share in `inactive (consumed)` should remain visible in retained detailed history
- history should show that the share is no longer retrievable
- history should expose a concrete consumed-like reason rather than mislabeling the entry as revoked or expired

### 7.3 Search

- a share in `inactive (consumed)` may remain searchable in the retained trusted-device search surface while retained
- search results must still reflect that the share is no longer retrievable

## 8. Refined History Rule Family

The earlier history rule described retained inactive objects in general terms.

That rule should now be understood more explicitly as including:

- invalidated retained records such as `revoked`, `expired`, and `source_invalidated`
- completed retained records such as `consumed`

Planning consequence:

- detailed history should continue to include completed records as well as invalidated and other non-active records
- `consumed` belongs in that retained completed/non-active family

## 9. Burn-After-Read Rule Remains Unchanged

This refinement does not weaken the existing burn-after-read rule.

Burn-after-read still means:

- the object becomes logically unavailable immediately
- the object enters the purge path rather than a retained inactive state
- the object should not remain in retained history or trusted-device search once purge completes

## 10. Cascading Rules Refinement

The earlier cascade rules remain correct, but they now need one explicit clarification.

### 10.1 Existing Cascades That Stay

- `source item inactive -> derived share object inactive (source_invalidated)`
- `burn-after-read trigger -> object enters purge path instead of retained inactive state`

### 10.2 New Clarification For Consumed Shares

If a share becomes `inactive (consumed)`:

- the ordinary recipient-targeted retrieval path is closed for that share
- sibling `ExtractionAccess` and `PublicLink` objects do not automatically become unavailable solely because the ordinary recipient delivery path was consumed
- sibling delivery objects still become unavailable through their own counters, validity, revocation, upstream source invalidation, or share-level burn-after-read purge

Reason:

- `ExtractionAccess` and `PublicLink` already have their own independent access-state families
- one `ShareObject` is the outward-delivery root for multiple sibling delivery modes in `v1`, so consuming one sibling delivery path must not silently collapse the others

## 11. Share-State Interpretation Rules

### 11.1 `revoked`

- sender or system intentionally withdrew the share before normal expiry

### 11.2 `expired`

- validity window ended naturally or by configured limit

### 11.3 `source_invalidated`

- the upstream source item became unavailable, forcing the derived share inactive

### 11.4 `consumed`

- the share completed its one allowed ordinary retrieval and is now closed

## 12. Retrieval Visibility Rule

Once a share is `inactive (consumed)`:

- ordinary recipient retrieval must fail as unavailable
- the UI should not present it as still downloadable
- retained history may still describe it as a finished record

## 13. Status And Messaging Guidance

User-visible retained status wording should preserve the difference between:

- `revoked`
- `expired`
- `source invalidated`
- `consumed`

Planning rule:

- the final UI wording may change, but the underlying semantic distinction must remain explicit in data and behavior

## 14. Minimal Refinement To `design/12-flow-and-state-model.md`

When the canonical state-model document is later updated, it should at minimum be revised to reflect:

- `ShareObject` inactive reasons now include `consumed`
- `active -> inactive (consumed)` is a valid transition for no-repeat shares on first successful retrieval
- retained history includes retained consumed-share records
- active timeline excludes consumed shares just as it excludes other non-active shares
- search may continue to include retained consumed-share records while retained

## 15. What Does Not Need New States

This refinement does not require new top-level state families for:

- `SourceItem`
- `ExtractionAccess`
- `PublicLink`
- burn-after-read purge phases

The main required state change is the explicit retained `consumed` outcome for `ShareObject`.

## 16. Security And Modeling Red Lines

Implementation planning should not allow these shortcuts:

- do not encode no-repeat share completion as `revoked`
- do not encode no-repeat share completion as `expired`
- do not let retained consumed shares be treated as still retrievable
- do not let burn-after-read objects fall back into retained `consumed` history
- do not invent a second hidden share lifecycle separate from the canonical state model

## 17. Follow-Up Planning Needed

The next planning work should still define:

- the exact canonical edits to `design/12-flow-and-state-model.md`
- the exact retained-history and search field representation for `consumed`
- the identity and admission/session baseline note that completes the current foundation set
