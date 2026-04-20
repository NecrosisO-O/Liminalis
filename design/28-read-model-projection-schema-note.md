# Liminalis Read-Model Projection Schema Note

## Status

- Detailed implementation-planning note

## Purpose

This document turns the accepted metadata/history/search boundary into a concrete projection-schema planning note for `Liminalis` `v1`.

Its goal is to define the minimum projection families, field groups, projection inputs, and visibility filters needed before later API planning and backend service breakdown.

This note builds on:

- `design/21-metadata-history-and-search-boundary-note.md`
- `design/22-flow-and-state-model-refinement-note.md`
- `design/26-live-transfer-session-and-fallback-note.md`

## 1. Planning Goals

- make the read-model boundary concrete enough for implementation planning
- define the minimum field groups for active timeline, detailed history, and trusted-device search
- keep projection content narrow and visibility-aware
- define how retained consumed shares and retained live-transfer records appear without becoming a second content system

## 2. Projection Families

`v1` should use four logical projection families:

- `ActiveTimelineItemProjection`
- `HistoryEntryProjection`
- `SearchDocumentProjection`
- `LiveTransferRecordProjection` when policy retains live-transfer records

## 3. Projection Source Rule

- projections are derived from write-side state changes and durable business outcomes
- projections are not the source of truth for lifecycle or access
- projections may be asynchronously updated through the accepted outbox + projector model

## 4. Common Projection Metadata

Each projection row should have at minimum:

- projection row id
- source domain object type
- source domain object id
- current projection status
- last projected version or event cursor
- projected_at timestamp

## 5. ActiveTimelineItemProjection

### 5.1 Purpose

- represent currently active visible items for trusted-device views

### 5.2 Minimum Field Groups

At minimum, the active timeline projection should carry:

- object identity: type and id
- display title or filename
- visible type label
- visible size or aggregate size
- grouped-item count where relevant
- sender or source label
- active-status label
- confidentiality level label
- key timeline timestamps
- current retrievability flag

### 5.3 Grouped-Content Fields

For grouped content, the active timeline projection may additionally carry:

- grouped-content indicator
- aggregate size
- grouped item count

### 5.4 Exclusions

- no full text bodies
- no deep manifest member listing by default
- no public-link pre-download metadata projection

## 6. HistoryEntryProjection

### 6.1 Purpose

- represent retained inactive, completed, or still-retained records with fuller retrievability detail

### 6.2 Minimum Field Groups

At minimum, history entries should carry:

- object identity
- display title or filename
- visible content-type label
- source or sender label
- confidentiality level label
- created time
- relevant completion or invalidation time
- current retained status
- retrievable or not retrievable flag
- concrete reason field when applicable

### 6.3 Retained Status Vocabulary

History should be able to represent at minimum:

- active-retained where allowed
- revoked
- expired
- source_invalidated
- consumed
- completed where completion is meaningful

### 6.4 Burn-After-Read Rule

- burn-after-read objects should not survive as retained history once purge completes

## 7. SearchDocumentProjection

### 7.1 Purpose

- represent narrow explicit searchable documents for trusted-device search

### 7.2 Minimum Searchable Fields

Search documents may include:

- title or filename
- visible summary for self-space text items
- sender or source labels
- visible type label
- visible retained status label when useful

### 7.3 Non-Searchable Exclusions

- full protected-content bodies
- full text-item bodies beyond the approved short summary field
- hidden internal operational metadata
- stale superseded package or access-grant versions

## 8. LiveTransferRecordProjection

### 8.1 Purpose

- represent retained live-transfer session records when policy says they should be retained

### 8.2 Minimum Field Groups

At minimum, retained live-transfer records may carry:

- session id
- participant identity labels appropriate to the viewer
- session outcome
- start and end times
- transport summary such as p2p or relay
- grouped or large-transfer indicator where relevant

### 8.3 Boundary Rule

- retained live-transfer records remain live-session records and must not masquerade as stored `SourceItem` or `ShareObject` records

## 9. Projection Input Events Or State Changes

The projector should react to at least these write-side outcomes:

- source-item created
- source-item invalidated or expired
- source-item burn-after-read purge completion
- share-object created
- share-object revoked, expired, source-invalidated, or consumed
- extraction exhausted or invalidated when history detail depends on it
- public-link exhausted or invalidated when history detail depends on it
- live-transfer completed, failed, cancelled, expired, or retained-record publication outcome

## 10. Visibility Filter Fields

Projection rows should carry enough fields to support current-visibility filtering without embedding full business logic in the projector.

At minimum this includes:

- current lifecycle status summary
- current retained status summary
- current retrievability flag
- visibility audience class where needed
- current access-sensitive visibility bit or equivalent derived filter field

Planning rule:

- final access truth still comes from current lifecycle and access evaluation; projection fields support filtering but do not replace those sources

## 11. Consumed Share Representation

For retained consumed no-repeat shares, projection behavior should be:

- excluded from active timeline
- included in history with `consumed` as the concrete retained reason
- allowed in search while retained
- marked non-retrievable

## 12. Grouped-Content Projection Rules

### 12.1 Active Timeline

- grouped-content cards should show top-level title, grouped-item count, and aggregate size

### 12.2 History

- history may retain the same top-level grouped fields plus a concrete retained status

### 12.3 Search

- grouped-content search should use top-level title and visible metadata only in `v1`
- manifest member names are not a required default searchable field set in `v1`

## 13. Text Projection Rules

### 13.1 Active Timeline

- self-space text may project a short visible summary or the same brief visible text surface already accepted by product rules

### 13.2 History

- history may show a summary while still relying on protected retrieval or local decryption paths for fuller text opening where applicable

### 13.3 Search

- only the approved short visible summary belongs in `SearchDocumentProjection`

## 14. Admin Boundary Rule

- control-plane views may consume separate operational aggregates
- admin tooling must not reuse trusted-device search projections as a back door to user-content reading

## 15. Projection Update Rules

### 15.1 Upsert Rule

- projectors should upsert current rows when retained visibility remains valid

### 15.2 Removal Rule

- rows should be removed or hidden when retention ends or purge completion makes them non-retained

### 15.3 Staleness Rule

- stale rows must not remain user-visible once current access or lifecycle rules make them ineligible

## 16. Security Red Lines

Implementation planning should not allow these shortcuts:

- do not let projection rows become long-term plaintext content stores
- do not index full manifest member names or full protected bodies by default when the design boundary does not allow it
- do not present retained live-transfer records as stored-transfer objects
- do not let consumed-share history be mislabeled as revoked or expired
- do not allow stale projection rows to bypass current access filtering

## 17. Follow-Up Planning Needed

The next planning work should still define:

- the exact physical schema for projection tables or collections
- the exact projector event payloads and rebuild strategy
- the API planning that maps timeline, history, search, and retained live-transfer records to endpoints
- the implementation sequencing note that places read-model work after core write-side state is stable enough
