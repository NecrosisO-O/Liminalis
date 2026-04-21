# Liminalis Frontend Surface And Interaction Baseline

## Status

- Active frontend planning note
- Consolidates design-phase surface decisions plus later frontend-relevant constraints for access, delivery, live-transfer, and admin experiences

## Purpose

This document captures the concrete frontend-surface and interaction rules for `Liminalis` that sit below shell and route architecture but above implementation detail.

Its goal is to preserve the already settled product-surface direction from the design phase while also carrying forward the later constraints that shape what the frontend may or may not show.

Planning precedence rule:

- when earlier design-phase surface direction is more specific than later high-level frontend abstraction, the design-phase surface direction should govern this note unless a newer dedicated frontend decision explicitly replaces it

## 1. Planning Goals

- keep surface wording direct and non-technical
- preserve the distinction between account identity, trusted-device access, protected retrieval, and public-link convenience delivery
- keep access-state pages, delivery pages, and admin control-plane pages structurally clear without leaking protected content assumptions across them
- make settled surface design details durable enough that later implementation does not drift back into generic templates

## 2. Theme Rule

- the frontend should support both light mode and dark mode
- theme switching is a first-class product capability rather than an afterthought
- the two themes should preserve the same information hierarchy, state semantics, and interaction structure rather than behaving like two different products
- confidentiality meaning, availability meaning, and access-state meaning must not rely on theme-specific color tricks alone
- existing design-phase color assignments and visual semantics must be preserved rather than reinterpreted during frontend styling work

## 3. Visual Style Baseline

- the overall product style should be simple, restrained, and tool-like
- pages should use large clean background areas rather than decorative visual noise
- layering should rely mainly on spacing, subtle borders, and restrained panel contrast rather than heavy shadows or strong gradients
- information density should stay moderate: enough to support daily use, but not dashboard-like
- icons should remain simple and consistent rather than decorative
- motion should stay minimal and purely functional

### 3.1 Surface Structure Rule

- the default surface language should use plain backgrounds, thin separators, and light panel grouping
- most screens should avoid deep nesting of cards inside cards inside cards
- page sections should be separated primarily by spacing and subtle boundary lines

### 3.2 Panel And Border Rule

- borders and separators are preferred over heavy shadow-based layering
- shadows may exist, but should remain light and secondary
- panels should feel stable and quiet rather than floating aggressively above the page

### 3.3 Corner Radius Rule

- corners should be rounded, but not soft or playful
- the whole product should use a consistent medium-radius system

### 3.4 Typography Rule

- typography should be clean and neutral
- heading scale should stay restrained rather than oversized
- supporting text should remain readable but visually secondary
- long explanation blocks should be avoided unless the flow truly requires them

### 3.5 State Expression Rule

- state should be expressed close to the object it belongs to
- the product should prefer small local indicators over large global warning treatments where possible
- status language should stay direct and compact

### 3.6 Theme Consistency Rule

- light mode and dark mode should preserve the same spacing, component structure, and visual hierarchy
- the two themes should feel like two renderings of the same product rather than two stylistically unrelated products

## 4. Timeline Default Composer Rule

- the ordinary timeline surface uses a bottom-docked default composer
- that composer is the primary quick-send surface for self-space text and lightweight single-file sending
- the composer layout is:
  - round confidentiality button on the left
  - text input area in the center
  - round attachment/file-send button on the right
- the confidentiality button controls the current lightweight send context
- folder upload, very large files, and more complex transfer forms remain outside this bottom composer and continue to use the advanced upload surface

## 5. Entry Surfaces

### 2.1 Login Surface

- login uses `username + password`
- `email` is optional metadata, not a login identifier
- the frontend must not imply that successful login alone grants trusted-device access or protected-content access
- `v1` should not expose email-reset, SSO, federation, or social-login assumptions as primary entry paths

### 2.2 Registration Surface

- registration requires invite code, username, and password
- optional email may be accepted but must not be treated as the primary account identifier
- registration should complete without automatic login by default
- the expected next step after registration is explicit login, after which a pending account routes to the waiting-for-approval surface

## 6. Waiting And Blocked Surfaces

### 3.1 Waiting For Approval

- a pending account may authenticate successfully but must see only the waiting-for-approval surface
- the waiting surface must not expose ordinary product navigation or content
- the page should explain that approval is still required before normal product entry

### 3.2 Blocked / Disabled Account

- a disabled account must not gain or keep ordinary product access
- the blocked surface must remain distinct from pending approval and from untrusted-device flows
- disabled-user handling must remain controlled rather than degrading into stale ordinary app rendering

## 7. Trusted-Device And Recovery Surfaces

### 4.1 General Messaging Rule

- state-page wording should remain direct and non-technical
- login-alone messaging should clearly explain that account access does not yet grant decryption access on a new browser
- trusted-device and recovery surfaces should use device-trust language rather than cryptographic terminology

### 4.2 Untrusted-Device Entry Rule

- the untrusted-device page should emphasize trusted-device approval as the main path
- recovery is a fallback path and should not be presented as an equally prominent primary button

### 4.3 Pairing-Waiting Rule

- the new-device waiting page should show both QR pairing and short-code fallback
- QR remains the primary trust-establishment path
- short-code fallback must remain usable rather than hidden as a dead-end backup path

### 4.4 Trusted-Device Approval Rule

- the trusted-device approval page should confirm the new device before trust is granted
- the trusted device should see visible non-cryptographic device context sufficient to avoid approving the wrong browser instance

At minimum, visible context may include:

- a user-friendly device label
- a coarse browser or platform summary
- recent login time
- approximate session-origin context if the product chooses to expose it

Planning rule:

- this context should help identification without turning the UI into a technical diagnostics page

### 4.5 Trust-Activation Rule

- a new device becomes trusted only after approved wrapped trust material has been received and successfully stored locally
- if local trust-material storage fails, the flow must remain restartable rather than appearing half-activated

## 8. Recovery-Code Surfaces

### 5.1 Recovery-Credential Structure

- recovery uses a set of three codes rather than one phrase
- each code is 20 characters long
- codes use only non-ambiguous letters and digits
- codes are shown in grouped segments for readability
- any one valid code from the current set can recover the account on an untrusted device

### 5.2 Presentation Rule

- first issuance and post-recovery rotation both use a strong interrupting page
- recovery codes should be shown as a full set rather than as individually emphasized standalone items
- the first version should provide `copy all` and `download text` actions
- the first version does not need per-code copy actions

### 5.3 Continuation Rule

- the continue action after recovery-code display should remain gated behind the accepted countdown period
- the same gating rule applies to the initial first-device recovery-code display and to rotated-code interruption after recovery

### 5.4 Durability Rule

- old recovery-code sets must not be viewable later
- after successful recovery, the newly rotated set must be re-displayable within the same recovered session until acknowledgment
- refresh or reopen during that interruption must re-show the same already-rotated set rather than generating a new one
- ordinary product entry must stay blocked until that interruption is acknowledged

## 9. Password Extraction And Public-Link Surfaces

### 6.1 Password Extraction Generation Rule

- the share UI may present the extraction link and password together for convenience
- the product should still treat them as credentials intended to be sent separately by the user

### 6.2 Password Extraction Retrieval Rule

- the retrieval-page flow is password first, metadata second, then explicit download
- after successful password entry, recipient-visible metadata may follow the same model as user-targeted share detail
- failed or unavailable extraction retrieval must not reveal unnecessary content detail

### 6.3 Public-Link Rule

- public links are the explicit convenience path rather than a protected-flow page
- opening a valid public link should begin download with minimal or no extra presentation
- public links must not display metadata or other information before download
- invalid public links should fail through a generic error page or equivalent generic failure response without exposing content detail

## 10. Live-Transfer Interaction Rules

### 7.1 Core Entry Rule

- live transfer is a separate explicit mode rather than a silent automatic switch
- one side creates a session, the other side joins, and both sides confirm before transfer begins

### 7.2 Transport Feedback Rule

- users should see lightweight transport-status labels rather than manually choosing transport mode
- the frontend should preserve the distinction between peer-to-peer attempt, relay fallback where allowed, active transfer, failure, expiry, and cancellation

### 7.3 Failure And Fallback Rule

- when live transfer fails, the main next action should be `switch to normal transfer`
- live-to-stored fallback must remain an explicit transition, not a hidden continuation

### 7.4 Timing Rule

- the first peer-to-peer attempt should time out after about 10 seconds before relay fallback is considered when policy allows it
- an unjoined live session should expire after about 5 minutes
- an established but inactive live session should end after about 10 minutes of inactivity

### 7.5 Content Boundary Rule

- live transfer applies to file-like content only in `v1`
- text messages are not part of live transfer
- grouped or large live transfer is allowed only when current policy permits it

## 11. Admin Control-Plane Surfaces

### 8.1 Boundary Rule

- the admin experience is a separate control-plane surface with strong boundaries from user content
- administrators use the same everyday transfer surface as regular users for normal transfer behavior; administrative power lives in the separate panel
- admin surfaces must not drift into content-reading or decryption capability

### 8.2 Overview Surface

The overview page may include:

- recent 24-hour transfer activity
- service health
- user counts
- device counts
- storage usage
- invitation status

### 8.3 Invite Surface

The invite-management surface should support:

- invite creation
- lists of active invites
- lists of consumed invites
- lists of expired invites
- invalidation of unused invites before expiry

### 8.4 Pending-Approval Surface

The pending-user queue may show at minimum:

- username
- optional email
- registration time
- invite provenance

### 8.5 User-State Surface

The user-management surface may show:

- enabled or disabled status
- approval status
- approval metadata
- invitation provenance
- limited device-count or limited device metadata

### 8.6 Policy-Management Surface Shape

The accepted admin policy surface structure is:

- one compact global header
- three fixed level tabs: `secret`, `confidential`, `top secret`

The global header includes:

- default confidentiality level selector
- restore-defaults action

Each level tab exposes only these editable policy sections:

- lifecycle
- share availability
- user-targeted sharing
- password extraction
- public links
- live transfer

Planning rule:

- fixed system rules must not appear as ordinary editable toggles

### 8.7 Policy Validation And Publication Rule

- policy validation errors must be surfaced clearly in the admin UI
- invalid policy combinations must block publication
- once validation succeeds, publication happens immediately
- `v1` does not need draft or scheduled publication workflows

### 8.8 Policy History Rule

The admin policy-history surface may show:

- level name
- bundle version
- updated time
- updating admin

### 8.9 Operations Surface

Operational visibility may include:

- storage usage totals
- counts of users, invites, and active objects where appropriate
- cleanup or background-job health summaries
- system-state health visibility
- limited cleanup actions such as expired-invite cleanup, stale pending-account cleanup, or failed/expired upload-session cleanup visibility

Planning rule:

- this remains operational metadata, not content inspection

## 12. Cross-Surface Messaging Rules

- directness is preferred over dramatic warning language
- product wording should avoid cryptographic jargon where trust/device language is enough
- public-link invalid states and password-extraction failures should remain generic enough to avoid leaking content details
- login, waiting, blocked, pair, recovery, and admin wording should preserve the difference between account state, device-trust state, and content access state

## 13. Cross-Surface Security And UX Red Lines

Frontend planning should not allow these shortcuts:

- do not present recovery as equally prominent with approval on the default untrusted-device page
- do not auto-approve a new device from QR scan or short-code entry alone
- do not allow ordinary product entry before recovery-code interruption acknowledgment completes
- do not show public-link metadata before download in `v1`
- do not let admin surfaces drift into content-reading views
- do not collapse password extraction and public links into one generic anonymous delivery UI
- do not conflate ordinary logout with deletion of local trusted-device material

## 14. Follow-Up Planning Priorities

The next frontend planning work should define at minimum:

- the fixed shell anatomy and layout regions of `WorkspaceShell`
- the exact timeline/default-composer layout and card system
- the exact access-shell page families and visual hierarchy
- the exact delivery/detail surfaces for share, extraction, and public-link flows
- the shared component vocabulary across user-site and admin-site products
