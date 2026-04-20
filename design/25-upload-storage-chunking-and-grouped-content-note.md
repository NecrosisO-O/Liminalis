# Liminalis Upload, Storage, Chunking, And Grouped-Content Note

## Status

- Detailed implementation-planning note

## Purpose

This document defines the implementation-planning baseline for stored-transfer ingestion in `Liminalis` `v1`, especially upload preparation, local encryption, chunking, grouped-content packaging, object-storage placement, resumability, and cleanup behavior.

Its goal is to make the stored-transfer path specific enough that later implementation sequencing, service decomposition, and API planning can rely on one shared upload and storage model before any code is written.

This note builds on:

- `design/14-storage-and-service-topology.md`
- `design/17-key-and-access-architecture-note.md`
- `design/24-confidentiality-policy-engine-and-bundle-note.md`

## 1. Planning Goals

- treat large-file support as a first-class architectural requirement
- avoid whole-file-in-memory assumptions
- keep ciphertext bodies reusable across later outward sharing
- make grouped files and folders a real stored-transfer shape in `v1`
- separate metadata database concerns from object-storage concerns
- support resumable upload without weakening encryption boundaries
- define orphaned temporary-object cleanup behavior before implementation

## 2. Scope

This note covers stored-transfer ingestion for:

- single files
- grouped files
- folders represented as grouped content

This note does not define:

- live transfer transport details
- final API endpoint shapes
- user-facing upload page layout

## 3. Core Ingestion Principle

`v1` stored transfer should use a prepare-then-upload model.

Planning consequence:

- the system should create an upload session before durable object activation
- content should be encrypted client-side before or during upload streaming
- the source item should not become an active visible stored object until upload finalization succeeds

## 4. Main Upload Objects

### 4.1 UploadSession

- A short-lived ingestion coordination object.
- Owns one upload attempt for one future `SourceItem`.
- Exists before the source item becomes active.

At minimum, it should track:

- upload session id
- uploader user id
- intended source content kind: single file, grouped content, or self-space text
- intended confidentiality level and source-creation policy result reference
- current phase
- temporary object references
- expiry time

### 4.2 UploadPart

- A logical uploaded ciphertext part or chunk belonging to one upload session.
- Exists so resumable upload can be modeled without relying on raw storage keys alone.

### 4.3 GroupManifest

- A structured manifest representing grouped files or folders.
- Preserves relative paths, item ordering where needed, member metadata, and member blob references.

### 4.4 Finalized SourceItem

- The durable stored-transfer business object created after successful finalization.
- References finalized ciphertext storage and its access package families.

## 5. Upload Session Phases

Each upload session should move through a minimal internal phase family:

- `created`
- `preparing`
- `uploading`
- `finalizing`
- `completed`
- `abandoned`
- `expired`
- `failed`

Planning rule:

- only `completed` upload sessions may activate the corresponding `SourceItem`

## 6. Source Creation Flow

When a stored source item is created:

1. the client asks the backend to prepare an upload session
2. the policy engine evaluates source creation under the chosen confidentiality level
3. the backend returns the resolved source-creation policy outputs and upload-session metadata
4. the client generates `SourceContentKey`
5. the client encrypts content locally while streaming or chunking upload payloads
6. ciphertext parts are uploaded into temporary storage locations
7. the client requests finalization once all parts are durable
8. the backend validates the upload session, creates the `SourceItem`, creates access packages, and binds the finalized storage references

## 7. Client-Side Encryption Rule

- ordinary protected file content must be encrypted locally before durable server-side storage
- the server may coordinate upload sessions and temporary-object references, but should not require plaintext file-body handling
- large-file encryption may be streaming or chunked, but must still produce one logical `SourceContentKey` boundary per source item

## 8. Chunking Baseline

### 8.1 When Chunking Applies

Chunking should be available for:

- large single files
- grouped-content member uploads when needed

### 8.2 Chunk Model

- each chunk belongs to one upload session and one logical source item
- chunk records should be addressable independently during upload
- chunk order or sequence metadata must be preserved for reconstruction

### 8.3 Logical-Key Rule

- chunking must not create a second unrelated business-level content identity
- the source item still owns one logical `SourceContentKey` boundary, even if internal chunk working material is derived underneath it

## 9. Resumable Upload Baseline

### 9.1 Resume Principle

- if an upload session is still valid, already uploaded durable ciphertext parts should be reusable rather than restarted blindly

### 9.2 Resume Scope

- resumability applies to ciphertext parts that have already been durably stored and acknowledged
- resumability does not require preserving client plaintext state in the server

### 9.3 Finalization Guard

- finalization must verify that all required parts are present before creating the active `SourceItem`

## 10. Single-File Storage Shape

For a single file source item:

- one finalized ciphertext body may exist as one object or a chunked object family
- the metadata database should store the durable metadata reference, not the whole file body

## 11. Grouped-Content Baseline

### 11.1 Grouping Model

Grouped content should use:

- one logical grouped `SourceItem`
- one manifest
- zero or more member ciphertext blob references

### 11.2 Supported Grouping Inputs

`v1` grouped content includes:

- multi-file selection
- folder upload represented through relative paths in the manifest

### 11.3 Manifest Fields

At minimum, the manifest should preserve:

- member id
- display name
- relative path
- member size
- member media or type label where useful
- member blob reference
- member ordering or stable listing order when needed

### 11.4 Folder Preservation Rule

- folder hierarchy should be preserved in manifest-relative paths
- the server should not flatten folder structure into an unordered file bag

## 12. Grouped Download Baseline

### 12.1 Whole-Group Download

- the default grouped-content retrieval behavior should allow whole-group download from one grouped source item

### 12.2 Archive Assembly Rule

- `v1` should prefer client-assembled archive generation for whole-group download
- server-side archive generation is not a core assumption for `v1`

### 12.3 Member-Level Retrieval Rule

- grouped-content planning should leave room for future per-member retrieval UX, but whole-group retrieval remains the baseline expectation

## 13. Metadata Database Versus Object Storage

### 13.1 Metadata Database Stores

The metadata database should store:

- upload sessions
- upload-part metadata
- source-item metadata
- source-item access-grant state
- policy snapshots
- grouped manifests or manifest references
- finalized storage references
- encrypted self-space text bodies in `v1`

### 13.2 Object Storage Stores

Object storage should store:

- ciphertext file bodies
- ciphertext grouped-content member bodies
- temporary upload chunks
- finalized large-file chunk objects

### 13.3 Boundary Rule

- metadata rows must not become a back door for large-file ciphertext persistence that properly belongs in object storage

## 14. Temporary Object Rules

### 14.1 Temporary Upload Objects

- upload parts may exist as temporary objects before finalization
- temporary-object references must remain bound to one upload session

### 14.2 Promotion Rule

- finalization should promote or bind temporary ciphertext objects into finalized source-item storage references without plaintext rewriting

### 14.3 Cleanup Rule

- abandoned, failed, or expired upload sessions must eventually trigger cleanup of orphaned temporary ciphertext parts

## 15. Finalization Rules

Before finalization succeeds, the backend should verify:

- the upload session is still valid
- the uploader identity still has permission to complete the session
- all required ciphertext parts are present
- grouped-content manifests are structurally valid when applicable
- source-creation policy results locked at prepare time remain applicable for that still-valid session

Prepare-lock rule:

- source-creation policy should be locked when the upload session is prepared
- as long as the prepared session remains valid and is not explicitly invalidated, finalization should use that locked source-creation policy result rather than re-checking newly changed current policy
- later policy changes should block newly created upload sessions, not retroactively break already prepared valid sessions

On successful finalization, the backend should:

- create the durable `SourceItem`
- persist the source snapshot fields
- persist access packages and `AccessGrantSet`
- bind finalized storage references
- mark the upload session completed

## 16. Abandonment, Expiry, And Failure

### 16.1 Abandoned Uploads

- an upload session may become `abandoned` when the client gives up explicitly or does not resume within validity rules

### 16.2 Expired Uploads

- expired upload sessions must not still be finalizable
- their temporary objects should be eligible for cleanup

### 16.3 Failed Uploads

- a failed upload session should remain diagnosable internally without activating a half-created source item

## 17. Share Reuse Rule

- once a source item's ciphertext storage is finalized, later outward sharing should reference that durable ciphertext body rather than duplicating the entire payload by default
- grouped-content outward sharing should follow the same reuse rule

## 18. Text Boundary Rule

- self-space text remains a first-class source item type
- encrypted self-space text bodies should remain in the metadata database in `v1`
- text does not enter grouped-content or live-transfer planning in `v1`

## 19. Large-File Operational Rules

Implementation planning should assume:

- upload progress may span prepare, encrypt, upload, finalize
- download progress may span fetch, decrypt, save
- failures may happen in any phase
- no phase should assume whole-file plaintext buffering as a requirement

## 20. Security Red Lines

Implementation planning should not allow these shortcuts:

- do not make whole-file-in-memory handling a requirement for large files
- do not activate a `SourceItem` before upload finalization is complete
- do not store plaintext protected file bodies during ordinary upload processing
- do not flatten grouped folders into a structureless bag when a manifest is required
- do not duplicate full ciphertext bodies by default when outward sharing can reference existing finalized storage
- do not leave orphaned temporary upload objects without a cleanup path

## 21. Follow-Up Planning Needed

The next planning work should still define:

- the exact upload-session field schema and expiry rules
- the exact manifest schema and member metadata contract
- the retrieval-protocol note that consumes finalized storage references
- the read-model projection note that defines grouped-content visible fields precisely
- the implementation sequencing note that places upload/storage work early in the stored-transfer core
