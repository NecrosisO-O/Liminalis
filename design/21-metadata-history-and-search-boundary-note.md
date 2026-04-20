# Liminalis Metadata, History, And Search Boundary Note

## Status

- Detailed implementation-planning note

## Purpose

This document defines the `v1` boundary for server-visible metadata, active timeline visibility, detailed-history retention, and trusted-device search.

Its goal is to make the read-model and metadata-privacy tradeoff explicit before implementation so that history, search, and presentation behavior do not quietly drift into a second content system or into accidental plaintext expansion.

This note builds on:

- `design/16-implementation-planning-decision-baseline.md`
- `design/19-access-grant-set-structure-and-update-rules.md`
- `design/20-retrieval-repeat-download-and-burn-after-read-semantics.md`

## 1. Planning Goals

- define the limited server-visible metadata boundary explicitly
- keep protected content bodies distinct from metadata projections
- define which product surfaces depend on read-model projection
- define how `AccessGrantSet`, lifecycle state, and retrieval outcomes affect visibility
- keep search intentionally narrow in `v1`
- preserve the control-plane boundary that admins cannot read user content on users' behalf

## 2. Boundary Statement

`v1` explicitly allows a limited server-visible metadata projection for usability-critical history and search behavior.

At the same time:

- `v1` does not store ordinary protected file bodies in plaintext on the server
- `v1` does not expand into full-text indexing of protected content bodies
- read models must remain projections of the stored-transfer domain rather than a second content system

## 3. Read-Model Surfaces

This note treats the following as explicit read-model or visibility surfaces.

### 3.1 Active Timeline

- the current valid visible object stream for trusted devices

### 3.2 Detailed History

- the retained non-active and completed record surface for trusted devices

### 3.3 Trusted-Device Search

- the explicit narrow search surface over titles and visible metadata

### 3.4 Delivery-Specific Metadata Surfaces

- metadata shown after password extraction is successfully unlocked
- metadata shown for user-targeted share detail views
- the explicit no-metadata-before-download rule for public links

## 4. Allowed Server-Visible Metadata Projection

The allowed projection should remain intentionally narrow.

### 4.1 Common Allowed Fields

The server-visible metadata projection may include:

- item title or filename
- object type
- file size or aggregate grouped-content size
- grouped-item count where relevant
- timestamps relevant to the visible surface
- source or sender identity labels
- current visible status label for retained records
- limited source context such as device label for self-originated items or sender label for incoming shares

### 4.2 Text Projection Rule

For text items:

- the server-visible projection may include a short visible summary field
- that summary must remain capped and intentionally narrow
- the summary exists for timeline, history, and search support rather than for full-text indexing

### 4.3 Grouped-Content Rule

For grouped content:

- the projection may include top-level title, count, aggregate size, and broad type labels
- `v1` should not assume deep server-indexed member-name search across full grouped-content manifests by default

## 5. Explicitly Excluded Server-Side Content Expansion

The following should remain outside the `v1` metadata/search boundary by default:

- full plaintext file bodies on the server
- full protected-content text indexing
- deep full-content preview for user-targeted shares before protected retrieval
- public-link metadata preview before direct download
- ad hoc server-side content reading APIs for admins

## 6. Projection Families

`v1` should treat these as distinct read-model projection families.

### 6.1 ActiveTimelineItemProjection

- built for current visible active items only
- optimized for main product timeline rendering

### 6.2 HistoryEntryProjection

- built for retained records and retrievability detail
- includes retained inactive and completed outcomes where product rules allow retention

### 6.3 SearchDocumentProjection

- built only from approved visible metadata fields
- intentionally narrower than the full timeline or history projection

## 7. Projection Maintenance Model

`v1` should keep metadata and read-model projection explicit.

### 7.1 Write And Projection Separation

- source and share business state remain the write-side source of truth
- active timeline, detailed history, and search remain projections derived from write-side events or state changes

### 7.2 Projection Mechanism

- the default planning baseline remains transactional outbox plus asynchronous projection
- projections should be rebuildable from authoritative state if needed
- projections should not depend on front-end-only assembly to become correct

### 7.3 Consistency Principle

- minor short-lived projection lag is acceptable in `v1`
- but policy-sensitive hiding, burn-after-read removal, and invalidation visibility should still reach user-visible consistency quickly

## 8. Access Filtering Principle

Read-model visibility is never determined by metadata projection alone.

Every visible record must still pass:

1. lifecycle or retention rules
2. current `AccessGrantSet` visibility rules where protected access is relevant
3. retrieval-outcome rules such as burn-after-read purge or no-repeat share consumption where applicable

## 9. Active Timeline Rules

### 9.1 Inclusion Rule

An item may appear in the active timeline only if:

- its underlying object is in an active visible lifecycle state
- the requesting trusted device has an allowed current access path
- no higher-precedence retrieval rule has already made it logically unavailable

### 9.2 Source Item Presentation Rule

- self-originated items may show source device name and timestamp
- active timeline detail should stay intentionally lightweight rather than becoming the full inspection surface

### 9.3 Share Presentation Rule

- incoming shared items may show sender identity label, title or filename, size, status, and other already approved visible metadata
- user-targeted sharing should not expose protected content preview before legitimate retrieval

### 9.4 Removal Rule

The active timeline should stop showing an item when:

- the object becomes inactive
- burn-after-read makes it logically unavailable
- a no-repeat share is consumed
- access is no longer allowed for the requesting trusted device

## 10. Detailed History Rules

### 10.1 Inclusion Rule

Detailed history should include retained records where product policy allows them, including:

- completed source or share records
- invalidated or expired records
- non-active records with concrete reasons where retention is allowed

### 10.2 History Detail Rule

History detail may show:

- title
- content type
- source label
- time fields
- current status
- whether the content is still retrievable
- concrete invalidation or completion reason when one exists

### 10.3 Text History Rule

- trusted devices may still open full text history where the accepted product rules allow it
- this does not require server plaintext storage of the full text body
- full text may still be obtained through protected retrieval and local decryption paths when needed

### 10.4 Burn-After-Read Rule

- burn-after-read objects should not remain as retained user-visible history after purge completion
- implementations may hide them earlier as long as they do not survive as normal retained history

## 11. Trusted-Device Search Rules

### 11.1 Search Scope

`v1` search should cover only approved visible fields such as:

- title or filename
- visible summary for text items
- sender or source labels
- visible type and status labels where useful

### 11.2 Search Exclusions

`v1` search should not cover:

- full protected-content text bodies
- plaintext file contents
- hidden or non-visible internal metadata
- superseded `AccessGrantSet` versions

### 11.3 Visibility Filter Rule

- search results must be filtered through the same current access and retention outcome used for other trusted-device visibility decisions
- a result should not appear just because a stale projection row still exists

## 12. Delivery-Specific Metadata Rules

### 12.1 User-Targeted Sharing

- recipient-facing metadata may follow the already accepted sharing metadata model
- the list or detail surface may show filename, size, sender, expiry, status, and related visible metadata
- content preview still remains outside the default user-targeted-share list surface

### 12.2 Password Extraction

- the password-extraction flow should ask for the password first
- only after successful password acceptance may the product show the approved visible metadata for that extraction path
- after unlock, the visible metadata model may match user-targeted share detail closely

### 12.3 Public Links

- public links should go directly to download and should not display metadata or other content information before download
- invalid or unavailable public links should fail generically without revealing content detail

## 13. Burn-After-Read Visibility Consequences

### 13.1 Active Timeline

- once burn-after-read fires, the object should stop behaving as an active visible item immediately from the product perspective

### 13.2 Detailed History

- burn-after-read objects should not survive as retained history once purge completes

### 13.3 Search

- burn-after-read objects should not remain searchable after purge completion

## 14. Accepted Default For No-Repeat Consumed Shares

The accepted `v1` default is:

- a consumed no-repeat share should leave the active timeline immediately
- it should remain in detailed history as a retained non-retrievable record with its own distinct consumed-like outcome
- it may remain searchable in the retained trusted-device search surface while retained, unless a later stricter rule is chosen

Reason:

- this treats no-repeat consumption as a real retained outcome rather than faking it as revocation or expiry
- it preserves a coherent user record of what happened
- it stays distinct from burn-after-read, which is intentionally non-retained after purge

## 15. Admin Visibility Boundary

### 15.1 Allowed Control-Plane Visibility

Admins may see only control-plane and operational metadata such as:

- counts
- health
- storage usage
- invite and approval provenance
- limited device metadata already accepted elsewhere in planning

### 15.2 Forbidden Expansion

Admins must not gain:

- user-content plaintext viewing
- protected-content search across user bodies
- user-facing content preview APIs disguised as admin tooling

## 16. Storage Placement Rules For Metadata Projections

### 16.1 Metadata Database

The metadata database may store:

- item metadata
- projection rows for active timeline, history, and search
- limited visible summaries for text where allowed
- projection support fields derived from object state, policy outcome, and access visibility

### 16.2 Object Storage

Object storage remains the home for:

- ciphertext payloads
- grouped-content ciphertext bodies
- large-file chunks

### 16.3 Plaintext Boundary Rule

- projection metadata must not be used as a back door to store protected bodies in plaintext form

## 17. Security Messaging Requirement

The implementation and future product messaging should be consistent about this boundary:

- `Liminalis` protects content bodies on protected flows
- `Liminalis` still keeps a limited server-visible metadata projection for history, timeline, and search usability in `v1`
- this is an explicit product tradeoff, not an accidental implementation leak

## 18. Security Red Lines

Implementation planning should not allow these shortcuts:

- do not silently expand metadata projection into full protected-content indexing
- do not let history or search become an alternate plaintext content store
- do not show public-link metadata before download in `v1`
- do not let stale projection rows bypass current access filtering
- do not let burn-after-read survive as ordinary retained searchable history
- do not let admin control-plane views drift into user-content reading capability

## 19. Follow-Up Planning Needed

The next planning work should still define:

- the exact projection field lists for each read-model family
- the state-model refinement needed to represent consumed no-repeat shares explicitly
- the identity and admission/session note that completes the current foundation-planning set
