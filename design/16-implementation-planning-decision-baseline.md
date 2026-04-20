# Liminalis Implementation Planning Decision Baseline

## Status

- Accepted pre-coding implementation-planning baseline

## Purpose

This document records the first implementation-planning decisions adopted before coding begins for `Liminalis` `v1`.

Its role is to remove high-risk ambiguity from the code phase, especially around security, access, lifecycle semantics, retrieval accounting, and planning boundaries.

This document remains the compact accepted decision summary.

Later detailed implementation-planning notes under `design/17` and beyond expand these decisions and should be used when finer-grained behavior is needed.

## 1. Core Pre-Coding Decisions

### 1.1 Key And Access Baseline

- Each `SourceItem` uses its own content-encryption key.
- Protected ciphertext bodies should be stored once and reused where possible.
- Protected access should be granted by wrapping source-item access material for distinct access contexts rather than by duplicating plaintext content paths.
- The main protected access contexts in `v1` are:
  - the owner's trusted-device access domain
  - a recipient trusted-device access domain for user-targeted sharing
  - password-derived access for `ExtractionAccess`
- Recipient-domain package issuance should rely on recipient-published public wrapping material rather than on server access to recipient plaintext roots.
- User-targeted sharing in `v1` should require that the recipient has already established a trusted-device domain and published the needed recipient wrapping material.
- If that recipient wrapping material is absent, the identity-bound protected share should be blocked rather than silently degraded into a weaker hidden path.
- `PublicLink` remains the explicit convenience exception and should use a distinct access path that does not weaken protected-flow assumptions.
- `ShareObject` remains distinct from `SourceItem` and should carry its own lifecycle state, policy snapshot, and access-package references.
- `AccessGrantSet` should be implemented as a concrete persisted structure rather than as an abstract implied rule.

### 1.2 Trusted-Device Bootstrap, Pairing, And Recovery Baseline

- The first trusted device should generate the user's root trusted-access wrapping material in the browser.
- Each trusted device should also have its own device keypair or equivalent device-specific access identity.
- QR pairing and short-code pairing should both allow an already trusted device to authorize wrapping the user's access material for a new device.
- Recovery should re-establish a new trusted device into the same trusted-access domain rather than into a weaker or special recovery-only tier.
- Recovery codes should unlock a recovery-wrapping path that can restore trusted access when no existing trusted device is available.
- Successful recovery should immediately rotate the recovery secret or recovery-wrapping material.

### 1.3 Policy Snapshot Semantics Baseline

- `SourceItem` and `ShareObject` should persist resolved policy snapshots for lifecycle-critical and access-critical behavior.
- Snapshot-driven behavior should include the values needed to preserve stable lifecycle semantics, such as chosen validity, access-related decisions, and delivery constraints relevant at creation time.
- Current policy should still be consulted at action time for future operations, such as whether a new share may be created now or whether live transfer may be started now.
- Changing the current policy bundle should not retroactively rewrite existing objects by default.
- Source-item confidentiality changes should affect future actions derived from that source item, but should not silently rewrite already created share objects.

### 1.4 Server-Visible Metadata Boundary Baseline

- `v1` explicitly allows a limited server-visible metadata projection for usability-critical history and search behavior.
- The allowed limited projection may include:
  - title or filename
  - item type
  - file size or grouped-item count metadata
  - timestamps
  - source or sender identity labels
  - an optional short text summary capped for display and search support
- `v1` should not store full protected-content plaintext bodies for ordinary file content.
- `v1` should not expand into full-text indexing of protected-content bodies.
- This metadata boundary should be reflected clearly in later implementation planning and security messaging.

### 1.5 Burn-After-Read Precedence Baseline

- Burn-after-read should override repeat-download and multi-device re-access expectations for the affected access domain.
- The first successful protected-content decryption event that satisfies the burn trigger should make the relevant object logically unavailable immediately.
- For burn-after-read content, UI and API behavior should not continue presenting ordinary repeat-download expectations.
- Burn-after-read objects should continue to follow the purge-path rule and should not remain in active timeline, retained history, or trusted-device search once purged.

### 1.6 Retrieval And Consumption Accounting Baseline

- Retrieval and download accounting should use explicit retrieval-attempt identities rather than ad hoc counters tied only to clicks or request starts.
- Protected-flow consumption should be recorded only after both transfer completion and client confirmation of usable decryption.
- Public-link consumption may be recorded on successful completion of the response stream because public-link delivery is the convenience exception path.
- Attempt handling should be idempotent so that retries or reconnects do not accidentally double-consume retrieval counts.
- Public-link retrieval should use short-lived delivery access rather than unmanaged long-lived direct object links.

### 1.7 Identity And Authentication Baseline

- `v1` should use local account authentication.
- Registration should use invite code plus username plus password, with email remaining optional metadata rather than a login identifier.
- Administrator approval remains required before full product access is granted.
- Session handling should use secure cookie-backed sessions.
- `v1` should not take on SSO or federation as a first-class requirement.
- Account authentication must remain distinct from trusted-device decryption access.

## 2. Early Implementation Defaults

### 2.1 Read-Model Projection Baseline

- Primary business writes should remain separate from timeline, history, and search read models.
- `v1` should use a transactional outbox plus asynchronous projection approach as the default planning baseline.
- Limited synchronous immediate-read handling is acceptable where needed, but projection should remain a deliberate subsystem.

### 2.2 Grouped Content Baseline

- Grouped files and folders should be modeled as a manifest plus member blob references.
- Folder structure should be preserved in the manifest.
- Whole-group download may be exposed as a client-assembled archive rather than requiring server-side archive generation as a core assumption.

### 2.3 Live Transfer Technical Baseline

- `v1` live transfer should plan around WebRTC data channels for peer-to-peer transfer.
- Relay should remain policy-controlled and should handle encrypted payloads rather than decrypted content.
- Stored-transfer fallback should remain an explicit separate handoff path rather than a hidden merge into one lifecycle engine.

### 2.4 Policy Evaluation Placement Baseline

- Policy evaluation should live in a dedicated backend domain service with a clear typed evaluation API.
- Frontend policy behavior should remain a UX mirror of backend-evaluated outcomes rather than an independent rule engine.

### 2.5 Admin Control-Plane Isolation Baseline

- `v1` may co-deploy the admin surface with the main application runtime.
- Even when co-deployed, admin routes, services, and authorization boundaries should remain explicit.
- Admin APIs must not expose decrypted-content access paths or content-body proxy behavior.

### 2.6 Session Timing And Logout Baseline

- `v1` account sessions should use a 30-day absolute expiry and a 7-day idle expiry baseline.
- Ordinary logout should invalidate the account session without automatically deleting trusted-device local material.

### 2.7 Policy Publication Baseline

- Confidentiality-policy edits should validate first, then publish immediately.
- Each successful publish should create a new current `PolicyBundle` version rather than rely on draft-versus-published staging in `v1`.

## 3. Deferred Items Still Kept Out Of `v1`

- share-first flow and its confidentiality interaction remain outside `v1`
- native-client-specific architecture remains outside `v1`
- bot-ingestion-specific architecture remains outside `v1`
- heavy public-link management workflows remain outside `v1`
- richer admin analytics beyond the agreed basics remain outside `v1`

## 4. Detailed Follow-Up Notes Now Recorded

These accepted later notes now expand the compact baseline above:

- `design/17-key-and-access-architecture-note.md`
- `design/18-trusted-device-pairing-and-recovery-protocol-note.md`
- `design/19-access-grant-set-structure-and-update-rules.md`
- `design/20-retrieval-repeat-download-and-burn-after-read-semantics.md`
- `design/21-metadata-history-and-search-boundary-note.md`
- `design/22-flow-and-state-model-refinement-note.md`
- `design/23-identity-admission-and-session-baseline.md`
- `design/24-confidentiality-policy-engine-and-bundle-note.md`
- `design/25-upload-storage-chunking-and-grouped-content-note.md`
- `design/26-live-transfer-session-and-fallback-note.md`
- `design/27-retrieval-protocol-and-package-issuance-note.md`
- `design/28-read-model-projection-schema-note.md`
- `design/29-admin-control-plane-and-policy-management-workflow-note.md`
- `design/30-recipient-wrapping-access-package-and-regrant-note.md`
- `design/31-recovery-rotation-and-trust-material-resilience-note.md`

## 5. Remaining Carry-Forward Notes

- the server-visible metadata boundary should still be treated as a real product and security decision in all later implementation work
- canonical summaries and earlier baseline documents should be kept synchronized with the accepted later notes so the repository preserves one clear working baseline
