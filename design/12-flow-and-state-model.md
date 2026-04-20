# Liminalis Flow And State Model

## Status

- Accepted flow-and-state-model draft

## Purpose

This document defines the main business flows and state transitions for `Liminalis` v1.

Its goal is to make lifecycle behavior explicit before implementation, especially around invalidation, retention, live transfer, and burn-after-read removal.

## Modeling Principles

- each core business object should own its own primary state machine
- user-visible retained states should be kept distinct from internal purge or cleanup paths
- burn-after-read should not survive as a retained user-visible final state
- active timeline and detailed history should be driven by state and retention rules rather than by ad hoc UI logic
- live transfer session state and live-transfer record retention should be modeled separately

## 1. Source Item Lifecycle

### Primary States

- `draft`
- `processing`
- `active`
- `inactive`
- `failed`

### Inactive Reasons

- `expired`
- `user_removed`

### Notes

- `inactive` is a retained state family for source items that are no longer active but still leave allowed product traces
- burn-after-read does not become an `inactive_reason`; it goes through a purge path instead
- text source items do not transition into outward-share or live-transfer flows in `v1`

### Core Transitions

- `draft -> processing`
- `processing -> active`
- `processing -> failed`
- `active -> inactive (expired)`
- `active -> inactive (user_removed)`
- `active -> purge path` when burn-after-read triggers

## 2. Share Object Lifecycle

### Primary States

- `created`
- `active`
- `inactive`

### Inactive Reasons

- `revoked`
- `expired`
- `source_invalidated`

### Notes

- inactive share objects may remain visible in retained history
- burn-after-read does not become an `inactive_reason`; it goes through a purge path instead

### Core Transitions

- `created -> active`
- `active -> inactive (revoked)`
- `active -> inactive (expired)`
- `active -> inactive (source_invalidated)`
- `active -> purge path` when burn-after-read triggers for the share object

### Notes On `created`

- `created` is a short internal construction state rather than a long-lived user-visible state
- once the delivery object is fully published and eligible for use, it should move to `active`

## 3. Password Extraction Lifecycle

### Primary States

- `active`
- `challenge_required`
- `exhausted`
- `expired`
- `revoked`
- `invalidated`

### Core Transitions

- `active -> challenge_required` after a failed password attempt
- `challenge_required -> active` after captcha satisfaction
- `active -> exhausted` when retrieval count is consumed
- `active -> expired`
- `active -> revoked`
- `active -> invalidated` when upstream share or source state invalidates access

### Notes

- a successful retrieval does not necessarily change the main state if allowed retrieval count remains
- if the parent share object enters purge or otherwise becomes logically unavailable, derived extraction access should become logically unavailable as well

## 4. Public Link Lifecycle

### Primary States

- `active`
- `exhausted`
- `expired`
- `revoked`
- `invalidated`

### Core Transitions

- `active -> exhausted` when configured download count is consumed
- `active -> expired`
- `active -> revoked`
- `active -> invalidated` when upstream share or source state invalidates access

### Notes

- if the parent share object enters purge or otherwise becomes logically unavailable, derived public-link access should become logically unavailable as well

## 5. Trusted Device Onboarding And Recovery

### Device Onboarding States

- `untrusted`
- `awaiting_pair`
- `awaiting_approval`
- `trusted`
- `rejected`
- `expired`

### Recovery States

- `untrusted`
- `awaiting_recovery`
- `recovered`
- `trusted`

### Notes

- onboarding and recovery are separate flows that converge on `trusted`
- recovery should not create a different long-term trusted-device category in `v1`
- successful recovery should trigger re-evaluation or re-grant of historical object visibility according to the same trusted-access domain rules

## 6. Live Transfer Session

### Primary Session States

- `created`
- `awaiting_join`
- `awaiting_confirmation`
- `connecting`
- `active`
- `completed`
- `expired`
- `failed`
- `cancelled`

### Transport Substates

- `p2p_attempt`
- `relay_attempt`
- `p2p_active`
- `relay_active`

### Core Transitions

- `created -> awaiting_join`
- `awaiting_join -> awaiting_confirmation`
- `awaiting_confirmation -> connecting`
- `connecting -> active`
- `connecting -> failed`
- `active -> completed`
- `awaiting_join -> expired`
- `active -> expired` when inactive too long
- intermediate states -> `cancelled` when abandoned by a participant

### Notes

- session completion is not the same thing as retaining a user-visible record
- retention of live-transfer history is a separate decision controlled by policy
- live-transfer failure may trigger explicit handoff to stored transfer when policy allows

## 7. Purge Path For Burn-After-Read

### Purpose

Represent the non-retained removal path triggered by burn-after-read.

### Internal Purge Phases

- `burn_triggered`
- `purging`
- `purged`

### Notes

- these are internal cleanup phases, not retained user-visible business states
- objects on the purge path should not remain in active timeline, detailed history, or trusted-device search
- for self-space uploads, this may remove online availability for other devices after the first successful decryption
- for text content, burn-after-read may enter the purge path through an explicit read-confirmation event rather than file decryption
- burn-after-read should cause immediate logical unavailability, even if the underlying physical purge completes asynchronously

## 8. Retention And Read-Model Rules

### Active Timeline

- includes active source items that are still valid and visible
- includes active share objects that are still valid and visible to the recipient
- excludes inactive objects
- excludes purged burn-after-read objects

### Detailed History

- includes retained inactive objects where product policy allows history retention
- excludes burn-after-read objects once the purge path completes

### Search

- follows the retained object set available to trusted devices
- excludes purged burn-after-read objects
- in `v1`, search is expected to cover titles and visible metadata by default rather than full-text protected-content search
- for text items, a short visible summary may serve as searchable visible metadata without becoming full-text indexing

## 9. Cascading Rules

The architecture should explicitly support these cascades:

- `source item inactive -> derived share object inactive (source_invalidated)`
- `share object inactive -> removed from active timeline and moved to retained history when history is allowed`
- `burn-after-read trigger -> object enters purge path instead of retained inactive state`
- `live transfer failure + allowed fallback -> explicit stored-transfer handoff flow`
