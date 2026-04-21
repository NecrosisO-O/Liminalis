# Liminalis Frontend Shell And Experience Architecture

## Status

- Active frontend planning note
- Captures the accepted high-level frontend shell strategy before detailed page, routing, and component work

## Purpose

This document defines the high-level frontend shell and experience architecture for `Liminalis`.

Its goal is to establish the stable outer structure of the frontend before detailed page design or implementation begins, so that routing, navigation, access gating, admin separation, and future frontend work follow one coherent model.

This note stays above component detail and exact visual specs. It defines:

- the main frontend shells
- which surfaces belong to each shell
- which shells must remain separate
- how user and admin experiences are separated
- how live transfer fits into the overall experience architecture

## 1. Planning Goals

- keep account entry, trust establishment, normal product use, public-link access, and admin control-plane experiences structurally separate
- preserve the product rule that account session and trusted-device access are distinct concepts
- make the default user experience center on self-space rather than on generic dashboards or admin-first surfaces
- keep send-to-self as the default visible product anchor when the user enters the ordinary web application
- keep send-to-others distinct from send-to-self even when outward sharing reuses the same stored-transfer substrate underneath
- prevent admin tooling from drifting into the normal user shell
- keep public-link access minimal and isolated from authenticated user flows
- define a shell model that is clear enough for later routing and page-family design without overcommitting to low-level UI details

## 2. Core Shell Principle

`Liminalis` should not use one universal frontend shell for every route.

Instead, the frontend should be organized into distinct shell families that match product state and trust boundaries.

Reason:

- the product has materially different operating contexts
- those contexts have different navigation rules, visibility boundaries, and user expectations
- merging them into one shell would blur security and product semantics even if route guards existed underneath

## 3. Accepted Shell Set

The accepted shell set is:

- `EntryShell`
- `AccessShell`
- `WorkspaceShell`
- `PublicLinkShell`
- `AdminShell`
- `LiveTransferModeShell` as a focused mode shell inside the main user product experience rather than a completely separate top-level product site

## 4. EntryShell

### 4.1 Purpose

- host account-entry surfaces before the user has entered the authenticated and gated product flow

### 4.2 Included Surfaces

- login
- registration with invite code

### 4.3 Structural Rules

- no normal product navigation
- no trusted-device workflow controls
- no admin control-plane layout
- no user content context
- should communicate instance entry and admission context clearly

### 4.4 Why It Must Remain Separate

- login and registration establish account identity only
- they should not visually imply trusted-device access or ordinary product availability
- they should not inherit the working-product frame

## 5. AccessShell

### 5.1 Purpose

- host all authenticated but not-yet-normal-product surfaces
- cover approval waiting, disablement blocking, trusted-device establishment, pairing, recovery, and trust-interruption flows

### 5.2 Included Surfaces

- waiting for approval
- blocked account
- first trusted-device setup
- first recovery-code interruption
- pair new device
- pair waiting
- pair approval
- recovery
- rotated recovery-code interruption

### 5.3 Structural Rules

- no normal product workspace navigation
- no timeline/history/search shell
- pages may use focused state or flow layouts
- should make clear that the user is authenticated but not yet in ordinary trusted-product use
- should preserve the distinction between admission state, enablement state, and trusted-device state

### 5.4 Why It Must Remain Separate

- these surfaces are not anonymous entry pages, so they do not belong in `EntryShell`
- these surfaces are also not ordinary trusted-product pages, so they must not inherit `WorkspaceShell`
- recovery-code interruption pages in particular would be weakened incorrectly if they were treated like settings subpages

## 6. WorkspaceShell

### 6.1 Purpose

- host the normal authenticated trusted-device product experience
- serve as the main long-lived working environment for ordinary users

### 6.2 Included Surfaces

- self-space timeline
- the default lightweight send surface embedded in the timeline experience
- the dedicated advanced upload surface for folder, large-file, and more complex transfer forms
- detailed history
- trusted-device search
- source-item detail and action surfaces
- share-related item actions and recipient-facing protected views that belong inside the authenticated experience
- user settings and trusted-access management
- live-transfer entry points and return surfaces

### 6.3 Structural Rules

- self-space should remain the default primary user surface
- the default send surface should remain list-centric rather than dashboard-centric or form-centric
- the main self-space experience may borrow from IM-like presentation patterns as long as it remains transfer-oriented rather than chat-oriented
- timeline, history, and search should remain distinct surfaces rather than collapsing into one generic object list
- the shell should support repeated daily use rather than behaving like a one-time setup wizard or admin console
- outward sharing should generally be action-driven from items rather than dominating top-level navigation by default

### 6.4 Why It Must Remain Separate

- normal use has a stable working-product frame unlike entry and trust-establishment flows
- it is the primary place where users read state, create uploads, manage items, and perform ordinary retrieval work
- it should not share an outer frame with admin control-plane tooling

## 7. PublicLinkShell

### 7.1 Purpose

- host anonymous bearer-style public-link delivery and related unavailable states

### 7.2 Included Surfaces

- public-link landing/download gate
- invalid, expired, revoked, or exhausted public-link outcomes
- delivery-in-progress and completion/error feedback where needed

### 7.3 Structural Rules

- completely independent from authenticated user shells
- no normal product navigation
- no metadata-preview expansion before download in `v1`
- should remain minimal, download-first, and generic when links are invalid
- should follow the accepted direct-download convenience-path direction rather than behaving like a rich recipient landing page

### 7.4 Why It Must Remain Separate

- public-link access is the explicit anonymous convenience path
- it has different visibility rules from both trusted-device retrieval and authenticated entry
- allowing it to inherit the normal user shell would create misleading expectations and unnecessary metadata exposure pressure

## 8. AdminShell

### 8.1 Purpose

- host the control-plane experience for invite management, approvals, user-state actions, policy management, and operational visibility

### 8.2 Included Surfaces

- admin overview
- invite management
- approval queue
- user state controls
- policy editing
- policy history
- operational and maintenance visibility

### 8.3 Structural Rules

- must remain a separate control-plane shell
- should be more tool-like and operational than the normal user workspace
- must not inherit or masquerade as the ordinary content-working shell
- should preserve the boundary that admin authority is not content-reading authority
- should preserve the product rule that administrators use the same everyday transfer surface as regular users for normal transfer behavior, while control-plane power lives in a separate panel

### 8.4 Why It Must Remain Separate

- the product design explicitly treats admin as a distinct control plane
- mixing it into the main user shell would blur role, navigation, and authorization boundaries
- operational visibility must not be allowed to drift toward content inspection through shell design shortcuts

## 9. LiveTransferModeShell

### 9.1 Purpose

- provide a focused live-transfer mode inside the normal user product experience
- support creation, join, confirmation, connection, transfer progress, failure, and explicit fallback without making live transfer look like an ordinary static workspace page

### 9.2 Included Surfaces

- live-transfer start
- join
- awaiting confirmation
- connecting
- active transfer
- failure and explicit handoff to stored transfer

### 9.3 Structural Rules

- should remain clearly distinct from stored-transfer list/detail surfaces
- should reduce ordinary workspace distractions while active
- should still conceptually belong to the main user product experience rather than becoming a completely separate public-facing site in `v1`
- should be entered intentionally rather than appearing as a silent automatic switch from stored transfer

### 9.4 Why It Is A Mode Shell Rather Than A Fully Separate Site

- live transfer is a distinct subsystem but not a separate product identity
- users should enter it from the main authenticated product context
- a focused mode shell is enough to preserve its distinct interaction model without overcomplicating the first frontend architecture cut

## 10. Accepted Separation Rules

The following separation rules are accepted:

- `EntryShell` and `AccessShell` must remain separate
- `AccessShell` and `WorkspaceShell` must remain separate
- `WorkspaceShell` and `AdminShell` should remain separate
- `PublicLinkShell` must remain completely separate from authenticated shells
- `LiveTransferModeShell` should remain structurally distinct inside the user product experience even if it is not implemented as a fully separate site

Reason summary:

- these boundaries reflect product-state truth, not only layout preference
- the frontend must reinforce the distinction between login, trust, ordinary product use, anonymous delivery, and admin control-plane use

## 11. Admin Frontend Deployment Decision

The accepted direction is:

- the admin frontend should be a separate frontend site from the ordinary user frontend
- in development this may run on a separate port
- in production this should preferably use a separate hostname or subdomain rather than relying on a raw alternate port as the long-term public shape

### 11.1 Practical Interpretation

- user frontend: separate site
- admin frontend: separate site
- backend: may still remain one backend application with explicit admin route families under `/api/admin/*`

### 11.2 Why This Direction Is Chosen

- it reinforces the control-plane boundary in both UX and implementation structure
- it reduces the chance that user-workspace and admin experiences become entangled in one frontend routing tree
- it allows the admin experience to evolve with its own information density and navigation model
- it preserves the already accepted boundary that admin is not merely another tab inside ordinary product usage

### 11.3 Frontend Planning Consequence

- frontend planning should assume at least two web applications:
  - the user application
  - the admin application
- both may still share brand tokens, lower-level design primitives, and the same backend identity system where appropriate
- they should not share one top-level page shell or one merged navigation model

## 12. Top-Level Experience Flow

At a high level, the accepted user-flow relation between shells is:

1. unauthenticated account entry begins in `EntryShell`
2. authenticated but not-yet-ordinary access states move into `AccessShell`
3. fully admitted and trusted ordinary use moves into `WorkspaceShell`
4. anonymous public-link access enters `PublicLinkShell` directly
5. admin control-plane use enters `AdminShell` as a separate site experience
6. live-transfer work uses `LiveTransferModeShell` inside the user product experience when active

Planning rule:

- bootstrap and related trusted-device state checks should decide whether the user enters `AccessShell` or `WorkspaceShell`
- shell selection should reflect backend truth rather than ad hoc frontend heuristics

## 13. What This Note Does Not Yet Fix

This note does not yet define:

- the exact route map for every frontend surface
- the exact navigation items inside `WorkspaceShell`
- the exact fixed layout regions of each shell
- the exact visual language of the design system
- the frontend state-management approach
- the precise boundary between protected incoming-share views and ordinary workspace navigation detail

Those should be handled in later frontend planning notes.

## 14. Follow-Up Planning Priorities

The next frontend planning work should define at minimum:

- the top-level frontend route and bootstrap decision map
- the fixed layout anatomy of each shell
- the main information architecture of `WorkspaceShell`
- the user-site and admin-site relationship, including entry and return paths
- the visual-system baseline for user, access, public-link, and admin experiences
