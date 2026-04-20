# Liminalis v1 API And Route Planning

## Status

- Detailed implementation-planning note

## Purpose

This document defines the API and route planning baseline for `Liminalis` `v1`.

Its goal is to translate the accepted domain boundaries and implementation sequence into a route structure that preserves state, trust, retrieval, admin, and live-transfer boundaries before any code is written.

This note stays above exact HTTP shapes and payload schemas where those would be premature. It defines route families, responsibilities, prohibitions, and sequencing posture.

## 1. Route Planning Principles

- route families should follow backend domain ownership, not page layout
- authenticated session routes must stay distinct from trusted-device access routes
- protected retrieval routes must stay distinct from public-link convenience routes
- admin routes must remain under an explicit control-plane namespace
- live-transfer routes must stay distinct from stored-transfer routes except at explicit handoff points
- read-model routes should expose projections, not write-side truth

## 2. Top-Level Backend Route Families

The safe top-level backend route grouping for `v1` is:

- `/api/session/*`
- `/api/auth/*`
- `/api/registration/*`
- `/api/bootstrap/*`
- `/api/trust/*`
- `/api/recovery/*`
- `/api/wrapping/*`
- `/api/policy/*`
- `/api/uploads/*`
- `/api/source-items/*`
- `/api/retrieval/*`
- `/api/shares/*`
- `/api/extraction/*`
- `/api/public-links/*`
- `/api/timeline/*`
- `/api/history/*`
- `/api/search/*`
- `/api/live-transfer/*`
- `/api/admin/*`

## 3. Identity, Admission, And Session Routes

### Major Route Groups

- account registration
- login and logout
- session validation or bootstrap

### Should Do

- register users with invite codes
- authenticate by `username + password`
- issue and invalidate secure cookie-backed sessions
- expose enough post-login state to route into waiting, blocked, untrusted, or trusted flows
- enforce disabled-user blocking at the session/bootstrap level

### Should Not Do

- should not imply trusted-device authority
- should not return protected-content access material
- should not bypass invite and approval rules

### Frontend Route Families

- `/register`
- `/login`
- session-expired or blocked-account entry surfaces where needed

## 4. Bootstrap Route Family

### Purpose

- answer the immediate question: given this browser session, what should the frontend show next

### Should Do

- return account admission state
- return enablement state
- return trusted-device state
- indicate whether first-device bootstrap is required
- indicate whether recovery interruption is pending

### Should Not Do

- should not be treated as a retrieval or trust-establishment route itself
- should not leak protected access material

## 5. Trusted-Device And Recovery Routes

### Major Route Groups

- first-device setup
- pairing session creation and status
- QR and short-code resolution
- approval and rejection
- recovery attempt and rotated-code acknowledgment

### Should Do

- coordinate first trusted-device establishment
- coordinate QR-first pairing and short-code fallback
- require explicit trusted-device approval before trust issuance
- support recovery attempt, rotation, and same-session re-display of the rotated set
- mark trust only after local trust-material storage succeeds

### Should Not Do

- should not grant trust based on authenticated session alone
- should not auto-approve from QR/short-code submission
- should not silently generate additional rotated recovery sets on reload

### Frontend Route Families

- `/device/setup`
- `/device/pair`
- `/device/pair/waiting`
- `/device/pair/approve`
- `/device/recovery`
- `/device/recovery/rotated-codes`

## 6. Public Wrapping And Access Substrate Routes

### Major Route Groups

- publication of user-domain public wrapping material
- publication of device public identities
- lookup or eligibility checks for recipient wrapping material
- later maintenance or regrant actions

### Should Do

- publish current recipient or owner public wrapping material safely
- support share-creation eligibility checks for identity-bound protected sharing
- support explicit maintenance/regrant routes later when needed

### Should Not Do

- should not expose private trust roots
- should not infer snapshot scope from current device state alone
- should not silently degrade missing recipient material into a weaker share model

## 7. Confidentiality Policy Routes

### Major Route Groups

- policy evaluation for product actions
- policy read routes for product setup constraints
- admin validation and publication routes

### Should Do

- expose structured evaluation outputs for source creation and later share/live actions where needed
- validate admin policy edits
- publish current `PolicyBundle` versions
- expose current bundle values and version history for admin workflows

### Should Not Do

- should not rewrite historical object snapshots through routes alone
- should not collapse into pure frontend form validation

## 8. Upload And Source-Item Routes

### Major Route Groups

- upload session preparation
- upload part registration or completion
- upload resume/status
- upload finalization
- upload abandonment
- source-item retrieval of write-side metadata where needed

### Should Do

- prepare upload sessions with locked source-creation policy outputs
- support resumable ciphertext-part upload
- validate manifests for grouped content
- finalize into active `SourceItem` objects only after all conditions are satisfied

### Should Not Do

- should not activate source items before finalization
- should not require plaintext-body handling on the server as a normal path
- should not let expired sessions finalize

### Frontend Route Families

- `/app/upload`
- `/app/upload/:session`
- text creation surfaces when those use the same prepare/finalize concept

## 9. Retrieval And Delivery Routes

### Major Route Groups

- retrieval-attempt creation and resume
- package-reference issuance
- protected completion confirmation
- public-link delivery-ticket issuance
- public-link ticket redemption or delivery path

### Should Do

- create or resume `RetrievalAttempt`
- resolve current package family through `AccessGrantSet`
- issue package references for protected flows
- require explicit client confirmation for protected completion
- issue short-lived public-link delivery tickets

### Should Not Do

- should not issue raw trust roots
- should not treat storage URLs as the full protected authorization model
- should not mark protected completion before client-confirmed usable decryption
- should not double-consume counts on retries

### Dependency Note

- self retrieval routes are early
- full multi-family retrieval accounting routes are later, after outward-delivery modes exist

## 10. Sharing Routes

### Major Route Groups

- share-object creation
- share detail or status views
- recipient eligibility checks
- share revocation and lifecycle actions

### Should Do

- create `ShareObject` from a `SourceItem`
- enforce recipient eligibility and current policy
- expose share state needed for recipient or sender views
- preserve repeat-download and no-repeat semantics through later retrieval hooks

### Should Not Do

- should not create identity-bound protected shares without recipient wrapping material
- should not collapse into extraction/public-link creation routes

### Frontend Route Families

- sharing panels or dialogs from item views
- recipient-facing incoming-share detail views

## 11. Password Extraction Routes

### Major Route Groups

- extraction creation
- password challenge
- extraction retrieval entry
- extraction state and count status

### Should Do

- create `ExtractionAccess` from a share object
- enforce password rules and captcha escalation
- keep extraction retrieval-count semantics separate from ordinary share repeat-download rules

### Should Not Do

- should not bypass share creation or share lifecycle
- should not decrement retrieval count before successful completion

## 12. Public-Link Routes

### Major Route Groups

- public-link creation
- link validation and landing
- short-lived delivery-ticket issuance
- link revocation

### Should Do

- create tracked `PublicLink` objects
- validate link state and issue short-lived delivery tickets
- support revoke, expiry, and download-count enforcement

### Should Not Do

- should not expose unmanaged long-lived object URLs
- should not expose pre-download metadata surfaces in `v1`

### Frontend Route Families

- public landing or download pages outside the authenticated app shell

## 13. Read-Model Routes

### Major Route Groups

- active timeline
- detailed history
- trusted-device search
- retained live-transfer record listing where allowed

### Should Do

- serve projection-backed active timeline data
- serve retained history with retrievability detail and concrete retained reasons
- serve narrow search over approved visible fields only
- serve retained live-transfer records as distinct session records where policy allows them

### Should Not Do

- should not become lifecycle or access source of truth
- should not expose full protected bodies or deep manifest member listings by default
- should not expose stale projection rows as visible truth

### Frontend Route Families

- `/app`
- `/app/history`
- `/app/search`
- live-record activity surfaces where policy retains them

## 14. Admin Routes

### Major Route Groups

- invite management
- pending-user approval
- user enable/disable
- policy editing, validation, publication, and restore defaults
- operational visibility and limited cleanup visibility

### Should Do

- stay under an explicit admin namespace
- orchestrate through identity, policy, and operational services
- expose operational metadata such as counts, health, and cleanup state
- record attribution-ready action metadata

### Should Not Do

- should not expose user plaintext content
- should not bypass trusted-device or retrieval boundaries
- should not mix user-facing and admin-facing authorization surfaces ambiguously

### Frontend Route Families

- `/admin`
- `/admin/invites`
- `/admin/pending-users`
- `/admin/users`
- `/admin/policy`
- `/admin/operations`

## 15. Live-Transfer Routes

### Major Route Groups

- session creation
- join and confirmation
- session state and negotiation updates
- transport updates
- explicit stored-transfer handoff after failure when allowed
- retained-record listing where policy allows it

### Should Do

- keep live transfer as a distinct session lifecycle
- support p2p-first and relay fallback only where policy allows
- support explicit live-to-stored handoff rather than silent continuation
- keep retained live-transfer records distinct from stored-transfer objects

### Should Not Do

- should not merge live and stored transfer into one hidden lifecycle engine
- should not allow relay use when disabled by policy
- should not create stored objects automatically merely because a live session failed

### Frontend Route Families

- `/live/start`
- `/live/:session`
- `/live/:session/join`
- fallback route into ordinary stored-transfer flow

## 16. Maintenance And Regrant Routes

### Major Route Groups

- explicit regrant and package maintenance actions
- recovery resilience support routes
- trusted-access removal-from-browser routes

### Should Do

- support explicit regrant when later needed by business semantics
- support same-session re-display of rotated recovery sets
- support explicit trusted-access removal from the current browser as a separate action from logout

### Should Not Do

- should not auto-regrant snapshot objects on ordinary device pairing
- should not conflate logout with deletion of local trusted-device material

## 17. Safe Early APIs Versus Late APIs

### Early Enabling APIs

- session, auth, and registration
- trust establishment and recovery core
- public wrapping publication
- source-creation policy evaluation
- upload prepare/upload/finalize
- self protected retrieval attempt, package issuance, and completion

### Late Dependent APIs

- user-targeted protected sharing
- password extraction
- public links
- read-model richness and retained live-transfer views
- admin control-plane completion
- live transfer
- explicit regrant and package maintenance surfaces

## 18. Cross-Cutting Route Red Lines

- do not let session bootstrap routes leak trusted-device authority
- do not let protected retrieval routes collapse into raw storage-link issuance
- do not let share APIs bypass recipient eligibility and wrapping-material checks
- do not let read-model routes redefine write-side truth
- do not let admin routes drift into user-content reading capability
- do not let live-transfer routes collapse into stored-transfer routes except through explicit handoff

## 19. Sequencing Alignment Summary

- Phase 1: session/auth/registration/bootstrap
- Phase 2: trust, pairing, and recovery routes
- Phase 3: wrapping/public-material and access-substrate support routes
- Phase 4: policy evaluation and publication routes
- Phase 5: upload and source-item activation routes
- Phase 6: self retrieval routes
- Phase 7: lifecycle and cleanup support routes
- Phase 8: timeline/history/search routes
- Phase 9: sharing, extraction, and public-link routes
- Phase 10: full retrieval-accounting completion across all families
- Phase 11: admin completion routes
- Phase 12: live-transfer routes
- Phase 13: maintenance and regrant routes

## 20. Review Rule

Every API planning pass should re-check:

- whether route groups still match backend ownership
- whether protected-flow routes remain stronger than convenience-exception routes
- whether route ordering still reflects the sequencing baseline instead of frontend page convenience
