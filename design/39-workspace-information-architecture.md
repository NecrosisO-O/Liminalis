# Liminalis Workspace Information Architecture

## Status

- Active frontend planning note
- Builds on the accepted shell and route architecture for the ordinary trusted user product experience

## Purpose

This document defines the high-level information architecture of the `Liminalis` user workspace.

Its goal is to make the main trusted-device product surface coherent before detailed page design or implementation begins, so that navigation, object organization, search entry, item actions, live-transfer entry, and settings all follow one stable product structure.

This note stays above exact component and layout implementation detail. It defines:

- the main workspace sections
- the accepted default landing surface
- which areas deserve top-level navigation
- which areas should remain action-driven or secondary
- how stored-transfer, share, search, history, and live-transfer objects should be organized in the normal user workspace

Planning precedence rule:

- where earlier design-phase product-surface decisions are more specific than later high-level frontend summaries, the design-phase surface direction should govern this workspace note unless a newer dedicated frontend decision explicitly replaces it

## 1. Planning Goals

- keep self-space as the default product anchor
- preserve the accepted distinction between active timeline, detailed history, narrow search, and live transfer
- avoid turning the workspace into a generic admin dashboard or file-manager clone
- preserve the accepted design-phase direction that the default self-space surface is list-centric with a prominent lightweight send surface inside it
- preserve the accepted IM-like active-timeline direction without collapsing the product into a chat app
- keep outward sharing action-driven from objects rather than making it the whole navigation model
- keep search powerful enough for the accepted read-model boundary without making it the primary top-level destination when no query exists
- preserve the boundary that live transfer is a distinct subsystem even when entered from the main workspace

## 2. Core Workspace Principle

The normal trusted user workspace should be organized around one primary idea:

- self-space is the center of gravity

Planning consequence:

- the first ordinary trusted landing should not be a metrics dashboard or a neutral blank home
- the workspace should open into an active self-space-centered surface where users can see currently relevant transfer objects and act on them
- other areas such as history, search, live transfer, and settings should support that center rather than replace it
- the default lightweight send/composer surface belongs inside that self-space-centered landing rather than replacing it with a dedicated create-first home

## 3. Accepted Main Workspace Sections

The accepted main workspace section set is:

- `Timeline`
- `History`
- `Live`
- `Settings`

In addition, the workspace should provide:

- global trusted-device search
- the default lightweight send/composer surface inside `Timeline`
- a dedicated advanced upload surface for folders, very large files, and more complex transfer forms
- object detail and action surfaces
- an admin-console entry for admin-capable users, but not as an ordinary primary workspace section

## 4. Why These Sections Are Chosen

### 4.1 Timeline

- this is the primary self-space and current-visible-object surface
- it matches the accepted product direction that the main experience is list- or stream-centered rather than dashboard-centered

### 4.2 Create

- creation remains a first-class user activity, but the accepted design direction does not require a standalone primary `Create` tab
- instead, the default lightweight send surface belongs inside the main timeline page, while more complex upload work moves to a dedicated advanced upload page

### 4.3 History

- retained inactive and completed records deserve their own explicit surface
- history must not be collapsed into timeline because they obey different visibility and retention semantics

### 4.4 Live

- live transfer is a distinct subsystem and should be visibly entered as such
- making it a stable top-level section preserves the accepted product boundary that live transfer is explicit, not a hidden fallback behavior

### 4.5 Settings

- trusted-access and account-local browser security actions need a clear home
- settings belongs in the ordinary workspace but should remain secondary to transfer work

### 4.6 Search As A Global Function Rather Than A Primary Static Section

- search is an accepted explicit read-model surface
- however, search is most coherent as a global query-driven function that opens a results view rather than as a primary landing section with no query intent
- it should still resolve to a stable route family such as `/app/search`, but the main product navigation does not need to treat it like a destination equal to timeline before the user has searched for anything

### 4.7 Advanced Upload As A Secondary Surface Rather Than The Default Home

- the accepted product direction keeps the default self-space surface list-centric
- folder upload, very large files, and more complex transfer forms should move into a dedicated advanced upload page rather than overloading the default composer
- the advanced upload page should remain a distinct secondary surface entered intentionally

## 5. Accepted Primary Navigation Model

The accepted direction is:

- primary navigation should emphasize `Timeline`, `History`, and `Live`
- `Settings` should be persistently reachable but may sit at lower navigation weight than the three main work surfaces
- `Search` should be globally reachable from the workspace header or command-style entry and lead into a dedicated search-results surface when used
- the dedicated advanced upload surface should be reachable predictably, but it should not displace `Timeline` as the main everyday landing surface

Planning rule:

- the workspace should not start with a crowded top-level navigation set that treats every object family as a first-class tab

## 6. What Should Not Be Top-Level Navigation By Default

The following should not become top-level primary workspace navigation by default:

- `Shares` as a standalone main tab
- `Incoming` as a standalone top-level site area at the first architecture cut
- `Public Links` as a primary navigation root
- `Admin` as a peer of ordinary user workspace sections
- a dedicated upload/create section that displaces the list-centric default self-space landing

Reason summary:

- outward sharing is primarily an action that starts from an object
- incoming protected share objects can be represented through the accepted timeline/history/search model and object-detail flows
- public links are a derived delivery mode, not the center of ordinary trusted user navigation
- admin belongs to a separate frontend site and separate shell
- the accepted product direction already places the lightweight composer inside the main timeline and reserves the dedicated upload page for heavier cases

## 7. Default Send Surface And Advanced Upload Boundary

### 7.1 Default Send Surface Rule

- the default send-to-self page should be list-centric rather than form-centric
- the main self-space page should show valid encrypted payloads for the current self identity
- that page should include a prominent upload or compose region for adding files or text
- the accepted later frontend decision places that default composer at the bottom edge of the timeline page rather than above the stream

### 7.2 Default Composer Layout Rule

The accepted default-composer direction is:

- text input and single-file sending sit next to each other
- the relationship may borrow from a chat input with an adjacent plus button
- the composer remains part of the timeline page rather than becoming its own isolated home page
- the composer is bottom-docked within the timeline page
- the confidentiality control and attachment/file-send control are both round buttons framing the text input area

### 7.3 Confidentiality Selector Rule

- the lightweight default send surface should expose a simple confidentiality switch on the left side of the bottom composer
- that send-surface confidentiality switch applies to both text and file actions in the current send context
- all confidentiality levels remain eligible for the lightweight send path
- confidentiality selection should not trigger extra confirmation steps or recurring risk-warning copy on each send
- the accepted later frontend decision uses a round button for this control

### 7.4 Advanced Upload Boundary Rule

- folder upload, very large files, and more complex transfer forms belong to a dedicated advanced upload page
- the advanced upload page should be entered intentionally rather than as a silent automatic redirect from the lightweight composer
- if the lightweight path cannot support the current content, the UI should show a warning rather than silently rerouting the user

### 7.5 Advanced Upload Policy Rule

- the advanced upload page should still expose confidentiality selection
- unlike the lightweight composer, the advanced upload page uses a dropdown selector for confidentiality level

## 8. Timeline Surface Architecture

### 7.1 Purpose

- show currently active, visible, trusted-device-accessible objects
- act as the default trusted landing surface
- keep the default send/composer surface and the current active object stream in one coherent everyday work surface

### 7.2 Included Object Types

At minimum, timeline should be able to show:

- active self-space `SourceItem` records
- active incoming `ShareObject` records visible to the current trusted user/device context
- active grouped-content records using their approved grouped-content summary fields
- self-space text items using the accepted brief visible text surface

### 7.3 Exclusions

- retained inactive-only history records should not remain in timeline once they are no longer active
- burn-after-read objects should not continue behaving like normal active entries after the burn trigger makes them logically unavailable
- retained live-transfer records must not be silently blended into stored-transfer cards as if they were normal source/share objects
- invalidated items should not remain as long-lived grey placeholders in the active timeline

### 7.4 Presentation Consequence

- timeline should feel like an active stream of current transfer objects
- it should remain intentionally lighter than history and should not become the exhaustive audit surface

### 8.5 Accepted Main-Timeline Presentation Direction

The accepted design-phase direction for the active timeline is:

- the timeline uses a chat-like left-right split
- the right side represents content uploaded from the current device
- the left side represents content arriving from other devices or other users
- each item uses a circular avatar container
- device-origin items use a device icon inside that avatar container
- user-origin items use a user icon or user initial inside that avatar container
- the title row shows only the device or user name on the left and the timestamp on the right

### 8.5a Bottom Composer Placement Rule

- the lightweight default composer belongs at the bottom of the timeline page
- it remains visible as the primary quick-send affordance while the active timeline stream occupies the main body above it
- the bottom composer consists of:
  - a round confidentiality button on the left
  - a central text-input region
  - a round attachment/file-send button on the right
- this bottom placement is the accepted later frontend decision and replaces earlier tentative top-of-page composer assumptions in frontend planning notes

### 8.6 Text Item Presentation Rule

- text items use a bubble-like presentation
- text items use a single-side confidentiality color accent
- long text items should support expand/collapse behavior rather than forcing full always-expanded rendering

### 8.7 File Item Presentation Rule

- file items use a file-card presentation rather than a chat bubble
- file cards should show icon, filename, format, and file size
- file-item confidentiality is expressed visually through the file icon background color
- clicking the file-card body starts download immediately
- a dedicated share button remains on the right side of the file card

### 8.8 Validity Representation Rule

- active timeline file cards use a small colored status dot to represent rough remaining-validity state instead of explicit text countdowns
- the accepted design language uses green-only semantics with shape variation:
  - soft light-green filled dot for still-safe
  - medium-green hollow dot for approaching expiry
  - darker thicker green ring for near-expiry

Planning consequence:

- active timeline should feel fast and scannable rather than countdown-heavy

### 8.9 Grouped-Content Card Rule

- folder and grouped-file items should share the same card skeleton as single-file items
- grouped cards should clearly indicate grouped content through icon and title treatment
- grouped-item secondary information should at minimum show item count and total size
- grouped items should use the same confidentiality-color and validity-dot language as single files
- clicking the grouped-item card body should download the whole grouped object
- grouped-item details should not expand inline in the active timeline

### 8.10 Metadata And Detail Constraint Rule

- active timeline detail should stay intentionally lightweight rather than becoming the full inspection surface
- detailed inspection belongs in the history page or dedicated detail surfaces rather than in deep inline timeline expansion
- timeline must stay inside the accepted visible-metadata boundary and must not expose deep content preview for protected items before legitimate retrieval
- public-link pre-download metadata must not appear in the ordinary trusted timeline

### 8.11 Visibility And Removal Rules

- only currently valid items remain in the main timeline
- if an item becomes invalid while the user is actively viewing or using it, the product should show an immediate status message
- a no-repeat share consumed by successful ordinary recipient retrieval leaves the active timeline immediately
- burn-after-read objects should stop behaving as active timeline items immediately from the product perspective
- timeline visibility must still respect current `AccessGrantSet` access truth, not only projected existence

## 9. History Surface Architecture

### 9.1 Purpose

- show retained non-active and completed records with fuller outcome detail and retrievability status

### 9.2 Accepted Product Direction

- history should lean toward user review rather than audit-heavy system inspection
- the detailed history page should act as a broader review and lookup surface rather than only a list of failures

### 9.3 Required Scope

- history includes completed records as well as invalidated and other non-active records
- history should provide search
- first-version filters should at least include status and source type
- history entries should show a concise combination of title, content type, source, time, and current status
- opening a history entry should show fuller detail, including whether the content is still retrievable
- text-message history may be opened for full viewing unless later confidentiality policy restricts that behavior

### 9.4 Structural Rule

- history must remain explicitly distinct from timeline
- history should support concrete retained reasons such as expired, revoked, source invalidated, consumed, and other accepted retained outcomes
- history may include retained live-transfer records where policy allows them, but those records must remain visibly distinct from stored-transfer object history

### 9.5 Invalidation And Burn Rules

- invalidated items should remain visible in detailed history
- history should show the specific invalidation or completion reason where applicable
- retained consumed shares must remain distinct from revoked or expired records
- burn-after-read objects should not remain in retained history once purge completes

### 9.6 Presentation Consequence

- history should feel more archival and explanatory than timeline
- users should understand why a record remains visible and whether it is still retrievable

## 10. Search Surface Architecture

### 10.1 Purpose

- provide trusted-device search over the accepted narrow visible metadata set

### 10.2 Entry Rule

- search should be entered from a global search affordance in the workspace rather than requiring a top-level static tab to have value
- search results should still live in a stable route family such as `/app/search`

### 10.3 Search Scope Rule

- search covers only the accepted visible fields such as title or filename, approved text summary, sender/source labels, and visible type or status labels where useful
- search must not imply full-content indexing or preview behavior beyond the accepted boundary
- search should not index full protected-content bodies, deep grouped-content member-name sets by default, or hidden internal metadata

### 10.4 Presentation Consequence

- search results should read like a filtered projection surface, not like a second file browser or content-preview system

## 11. Item Detail And Action Architecture

### 11.1 Purpose

- provide the focused surface for one object's metadata, current state, retrievability, and available actions

### 11.2 Included Detail Families

- self-space source-item detail
- incoming protected share detail
- grouped-content top-level detail
- retained history detail where appropriate

### 11.3 Action Rule

- outward sharing, password extraction creation, public-link creation, retrieval, and related object operations should generally begin from item detail or item action surfaces rather than from a disconnected top-level navigation section
- the share-first product path remains outside `v1`; item-first sharing remains the accepted workspace model

### 11.4 Why This Rule Exists

- it keeps the workspace object-centered
- it prevents outward-sharing modes from displacing self-space as the main architecture center
- it better matches the domain model in which outward sharing is derived from source objects rather than being a standalone universe of objects without context

### 11.5 Outward Sharing Methods

The accepted outward delivery methods remain:

- specify another user
- password-protected extraction
- generate a public link

Text messages remain outside outward sharing in `v1` and stay in self-space only.

## 12. Incoming Share Organization Rule

Incoming protected shares should be represented inside the ordinary workspace model without becoming a separate first-class shell.

Accepted direction:

- incoming share records may appear in timeline, history, and search where the accepted visibility rules allow them
- item detail should make clear whether a record is self-originated or received from another user
- if filters are needed later, `shared with me` should be treated as a view or filter dimension rather than proof that the whole information architecture should pivot to a separate top-level product area
- the recipient main timeline should remain an active view rather than a complete archive

## 13. Outgoing Sharing Organization Rule

Outgoing sharing should remain action-driven.

Accepted direction:

- users create shares from eligible source objects
- extraction access and public links are derived from share objects and should remain secondary or sibling action surfaces rather than top-level navigation roots
- the workspace may later expose summary views or management filters if needed, but the first architecture cut should not center the whole product on share administration

### 13.1 Recipient Eligibility Constraint

- identity-bound protected sharing must be blocked when the intended recipient lacks the required trusted-device public wrapping material
- when that happens, the workspace may guide the sender toward another allowed delivery mode such as password extraction or public link when policy permits it

### 13.2 Delivery-Specific Metadata Constraint

- recipient-facing share list/detail views may show filename, size, sender, expiry, status, and related approved visible metadata
- user-targeted sharing should not expose protected content preview before download
- no-repeat consumed shares remain retained history/search outcomes rather than being mislabeled as revoked or expired

### 13.3 Password Extraction Constraint

- extraction creation is derived from a share object
- the share UI should present the extraction link and password together for convenience, while leaving the act of sending them to the user's own workflow
- the retrieval flow itself remains password first, metadata second, then explicit download

### 13.4 Public-Link Constraint

- public links are derived delivery objects, not primary navigation roots
- public-link delivery should go directly to download and should not display metadata before download
- invalid public links should fail generically without revealing content detail

## 14. Live Section Architecture

### 14.1 Purpose

- give users an explicit place to start and monitor live transfer as a distinct product mode

### 14.2 Structural Rule

- the `Live` section is a valid primary workspace section because live transfer is explicitly a distinct subsystem
- when an active session begins, the experience shifts into `LiveTransferModeShell` while still belonging to the user workspace product family
- live transfer must remain an explicit user-entered mode rather than an automatic silent fallback from stored transfer

### 14.2a Interaction Direction

The accepted live-transfer interaction direction is:

- one side creates a temporary live-transfer session
- the other side joins that session
- both sides confirm before file transfer begins
- the system attempts peer-to-peer transport first
- if peer-to-peer setup fails and policy allows it, the system automatically falls back to relay transport
- the user sees lightweight transport-status labels rather than manually choosing the transport mode
- if live transfer fails, the primary next action should be `switch to normal transfer`
- an unjoined live session should expire after about 5 minutes
- an established but inactive live session should end after about 10 minutes of inactivity

### 14.3 Boundary Rule

- live-transfer records must remain recognizably different from stored-transfer records
- explicit fallback to stored transfer must remain a visible transition rather than an invisible route substitution

## 15. Settings Architecture

### 15.1 Purpose

- host account-local, browser-local, and trusted-access management surfaces that belong to the normal user experience but are not primary day-to-day transfer destinations

### 15.2 Expected Scope

- this-browser trusted access actions
- trusted-device visibility and browser-local trust-management actions where permitted
- account profile basics where needed
- security and local session or trust-state actions that belong to the ordinary user

### 15.3 Exclusions

- admin policy editing
- invite management
- approval queue and control-plane operations

### 15.4 Trusted-Access Removal Rule

- removing trusted access from the current browser should remain a separate explicit security action rather than being conflated with ordinary logout

## 16. Admin Entry Rule Inside The Workspace

For admin-capable users:

- the workspace may expose an `Admin Console` entry action
- that entry should live in a user menu or similarly explicit secondary control location
- it should not appear as a normal peer of `Timeline`, `History`, or `Live`
- using it should transition into the separate admin frontend site

## 17. Workspace Object Vocabulary Rule

The workspace should preserve object vocabulary clearly enough that users can understand what kind of record they are viewing.

At minimum, the product should remain able to distinguish:

- self-space source item
- incoming protected share
- grouped stored-transfer object
- retained history record
- retained live-transfer record

Planning rule:

- the information architecture should not flatten all of these into one unlabeled generic file card model

## 18. Workspace Default Landing Rule

The accepted default trusted landing is:

- `Timeline`

More specifically:

- `/app` should resolve to the main active timeline or equivalent self-space-centered current-work surface

Reason:

- this best matches the accepted product direction that the default experience is send-to-self centered and stream-like rather than dashboard-like

## 19. Security And UX Red Lines

Frontend workspace planning should not allow these shortcuts:

- do not replace the self-space-centered landing with a generic metrics dashboard
- do not collapse timeline and history into one ambiguous list
- do not treat search as proof that full protected-content indexing exists
- do not make outward sharing the dominant top-level navigation center by default
- do not let public-link concepts leak into ordinary trusted navigation as if they were a normal main workspace mode
- do not present retained live-transfer records as ordinary stored-transfer items without visible distinction
- do not embed admin control-plane work into the ordinary workspace navigation tree
- do not replace the accepted default composer with a form-centric upload-first home surface
- do not silently auto-redirect lightweight send into the advanced upload page
- do not keep invalid or consumed items lingering as active timeline placeholders
- do not expand grouped-content member details inline in the active timeline
- do not treat confidentiality level as a reason to hide otherwise approved trusted-device metadata in timeline or history

## 20. What This Note Does Not Yet Fix

This note does not yet define:

- the exact fixed layout anatomy of `WorkspaceShell`
- the exact visual hierarchy of navigation regions
- the exact filter model inside timeline and history
- the exact route and panel strategy for item detail
- the exact global-search interaction design
- the exact settings sub-navigation model

Those remain later frontend planning work.

## 21. Follow-Up Planning Priorities

The next workspace-oriented frontend planning work should define at minimum:

- the fixed shell anatomy of `WorkspaceShell`
- the navigation regions and their visual priority
- the item-detail model and action drawer/panel/page strategy
- the shared card vocabulary for source items, shares, grouped content, and retained live-transfer records
- the global search entry and results model
