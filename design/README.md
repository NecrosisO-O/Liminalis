# Liminalis Documentation Index

This directory stores the approved design, architecture, and implementation-planning artifacts for `Liminalis`.

## Principles

- Keep design, architecture, and implementation-planning decisions traceable.
- Prefer durable product framing and explicit architecture over premature coding.
- Mark assumptions and deferred items clearly when they are not yet confirmed.

## Documents

- `design/01-product-definition.md`: product vision, problem framing, design principles
- `design/02-scenarios-and-scope.md`: target users, use cases, scope tiers, non-goals
- `design/03-open-questions.md`: unresolved product questions that need confirmation
- `design/04-remaining-design-issues.md`: ordered checklist of design decisions and their outcomes
- `design/05-confidentiality-impact-map.md`: product-wide map of confidentiality-policy effects
- `design/06-design-review.md`: end-of-design review snapshot and deferred items
- `design/07-confidentiality-default-presets.md`: built-in confidentiality defaults for `v1`
- `design/08-architecture-phase-plan.md`: macro work plan for the architecture phase
- `design/09-v1-architecture-boundary.md`: accepted `v1` architecture boundary and deferred assumptions
- `design/10-system-module-boundaries.md`: accepted logical modules and dependency directions
- `design/11-core-domain-model.md`: accepted business objects, relationships, and read-model boundaries
- `design/12-flow-and-state-model.md`: accepted state transitions, purge paths, and cascade rules
- `design/13-security-and-key-architecture.md`: accepted security and key-handling architecture baseline
- `design/14-storage-and-service-topology.md`: accepted runtime roles, storage placement, and deployment shape
- `design/15-implementation-architecture-baseline.md`: accepted implementation-facing architecture baseline for `v1`
- `design/16-implementation-planning-decision-baseline.md`: adopted pre-coding implementation-planning decisions and defaults
- `design/17-key-and-access-architecture-note.md`: detailed planning note for protected key roles, access packages, and recovery boundaries
- `design/18-trusted-device-pairing-and-recovery-protocol-note.md`: detailed planning note for trusted-device establishment, QR pairing, short-code fallback, and recovery restoration
- `design/19-access-grant-set-structure-and-update-rules.md`: detailed planning note for `AccessGrantSet` fields, versioning, and access-update triggers
- `design/20-retrieval-repeat-download-and-burn-after-read-semantics.md`: detailed planning note for retrieval success, counters, no-repeat share consumption, and burn-after-read precedence
- `design/21-metadata-history-and-search-boundary-note.md`: detailed planning note for server-visible metadata limits, read-model surfaces, and trusted-device visibility rules
- `design/22-flow-and-state-model-refinement-note.md`: detailed planning note refining `ShareObject` state semantics around retained consumed no-repeat shares
- `design/23-identity-admission-and-session-baseline.md`: detailed planning note for account identity, invite admission, approval gating, and cookie-session behavior
- `design/24-confidentiality-policy-engine-and-bundle-note.md`: detailed planning note for the policy engine, `PolicyBundle` structure, and snapshot versus action-time evaluation rules
- `design/25-upload-storage-chunking-and-grouped-content-note.md`: detailed planning note for upload sessions, ciphertext storage, resumability, and grouped-content handling
- `design/26-live-transfer-session-and-fallback-note.md`: detailed planning note for live-transfer sessions, retained-record behavior, and explicit handoff into stored transfer
- `design/27-retrieval-protocol-and-package-issuance-note.md`: detailed planning note for retrieval attempts, package references, completion confirmation, and public-link delivery tickets
- `design/28-read-model-projection-schema-note.md`: detailed planning note for timeline, history, search, and retained live-transfer projection schemas
- `design/29-admin-control-plane-and-policy-management-workflow-note.md`: detailed planning note for invite, approval, disablement, and policy-management workflows
- `design/30-recipient-wrapping-access-package-and-regrant-note.md`: detailed planning note for recipient public wrapping material, access-package metadata, and explicit regrant behavior
- `design/31-recovery-rotation-and-trust-material-resilience-note.md`: detailed planning note for recovery rotation durability and local trust-material resilience
- `design/32-v1-implementation-sequencing-and-milestones.md`: detailed planning note for safe implementation ordering, dependency phases, and milestone structure
- `design/33-backend-domain-and-service-breakdown.md`: detailed planning note for stable backend domains, service ownership, dependency rules, and code-boundary risks
- `design/34-v1-api-and-route-planning.md`: detailed planning note for backend route families, frontend route boundaries, and late-versus-early API surfaces
- `design/35-v1-milestone-decomposition-and-acceptance.md`: detailed planning note for milestone decomposition, scope boundaries, and acceptance criteria
- `design/36-code-phase-macro-plan.md`: recorded macro plan for the code phase; execution still requires explicit user instruction

## Current Status

- Design and architecture are complete enough to support implementation planning
- The current phase is implementation planning under a no-code gate
- The accepted baseline now lives in both canonical architecture documents and later detailed implementation-planning notes
- The next documentation work should keep canonical summaries synchronized with the accepted later notes before or alongside later implementation sequencing
