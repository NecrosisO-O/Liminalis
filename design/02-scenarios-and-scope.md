# Liminalis Scenarios And Scope

## Status

- Draft: near design closure
- Historical design-phase scope document; later accepted architecture and implementation-planning notes refine this scope into the working `v1` baseline

## Working Target Users

These are draft user groups for design discussion, not final market commitments.

- A primary self-hosting owner who deploys `Liminalis` on their own server and uses it heavily for personal device-to-device transfer
- Trusted friends or other frequent collaborators who are invited into that hosted instance for secure recurring exchange
- Power users who frequently transfer folders, media, archives, or project files inside that hosted environment

## Core Usage Scenarios

### Send to self

Move files between personal devices with minimal friction.

This is the product's foundational mode and should be the default landing experience in the browser.

The current direction is that send-to-self defaults to encrypted temporary holding: ciphertext sent from one device becomes visible and downloadable on all devices logged in as the same identity.

The current identity model treats the user account as the owner of the self-transfer space, while trusted devices are the concrete endpoints allowed to decrypt and access that space.

Examples:

- phone to desktop
- laptop to tablet
- one workstation to another on a different network
- send short text, links, codes, or notes to yourself across devices

### Send to another person

Hand off files quickly without assuming the recipient already uses the same platform.

This is a distinct mode rather than a small variation of send-to-self. It can involve additional steps, identity checks, or sharing actions.

The current direction is to keep the same encrypted temporary holding path as the base transport, then add sharing controls that grant access outward.

In the current user model, "another person" usually means another account within the same self-hosted instance rather than an arbitrary public recipient.

Examples:

- sharing reference files with a teammate
- sending large media or archive packages
- sending a folder that should preserve structure

### Temporary delivery

Provide a transfer path for one-time or short-lived delivery rather than permanent storage.

This now includes both file payloads and short text payloads.

### Resilient transfer

Handle large files, unstable networks, interrupted sessions, and resumable progress more gracefully than ad hoc messaging tools.

### Smart fallback

If one transfer path is inconvenient or unavailable, the product should steer users toward another workable path with minimal confusion.

The current direction is a mixed model: support live transfer when both sides are online, while also allowing encrypted temporary holding through the service when one side is offline.

For send-to-self specifically, encrypted temporary holding is the default rather than the fallback.

Live transfer is now defined as a separate mode rather than an automatic silent switch. The user should intentionally enter an online direct-transfer page on both devices, confirm the pairing, and then start the transfer.

The online direct-transfer mode is expected to support both relay-assisted and peer-to-peer transport.

Online direct transfer should focus on files rather than text messages.

In online direct transfer, sending to another of the user's own devices and sending to another user do not need to be modeled as two strongly different product modes. The live session can be treated as one unified confirmed peer session.

The accepted first-version live-transfer structure is:

- one side creates a temporary live-transfer session
- the other side joins that session
- both sides confirm before file transfer begins
- the system attempts peer-to-peer transport first
- if peer-to-peer setup fails, the system automatically falls back to relay transport
- the user sees only lightweight status labels rather than choosing transport mode manually
- if live transfer cannot be established successfully, the product should guide the user back to the normal stored-transfer path
- the first peer-to-peer attempt should time out after about 10 seconds before automatic relay fallback
- the failed-state primary action should be "switch to normal transfer"
- an unjoined live session should expire after about 5 minutes
- an established but inactive live session should end after about 10 minutes of inactivity

## Initial Scope Shape

### Must support in the first useful version

- Sending files and folders
- Sending text messages
- Clear transfer progress and result states
- Transfers to self and transfers to others as distinct first-class concepts
- Send-to-self as the default entry experience in the web UI
- A visible list of currently available encrypted payloads for the logged-in self identity
- Reasonable handling of interrupted or failed transfers
- A simple mental model that does not require users to understand transport internals
- Browser-based upload and download across different devices
- A service-and-node structure, with the cloud service coordinating connected device nodes
- End-to-end encryption as a baseline requirement
- Full transfer capability for non-admin users inside the hosted instance
- Clear separation between transfer features and server administration privileges
- Upload-time confidentiality selection with a default level
- Optional burn-after-read behavior as part of transfer policy
- Web-only delivery for the first version

### Should support early if feasible

- Large file transfers
- Share links or equivalent handoff mechanisms
- Expiration or lifecycle controls for temporary transfers
- Basic transfer history

### Better left for later unless design strongly requires them

- Full team workspace or long-term cloud drive behavior
- Deep document collaboration features
- Rich media management or gallery workflows
- Enterprise governance features as a primary focus
- External integration surfaces such as a Telegram bot for upload or handoff convenience
- Native desktop or mobile clients

## Product Non-Goals For Now

- Replacing every cloud storage product
- Becoming a chat app
- Becoming a general sync platform for all user data
- Treating permanent storage as the primary product value

## Product Structure Implication

The product should not present "send to self" and "send to others" as the same screen with minor labels changed.

At the design level, they are separate modes with different expectations:

- send to self emphasizes speed, continuity, and low-friction device handoff
- send to others emphasizes deliberate delivery, recipient access, and controlled sharing

For send-to-others, the current proposal is not a separate upload pipeline. Instead, content still enters stored encrypted holding first, then the sender applies a sharing method.

For the first version, send-to-others should use only the item-first path: upload or create content first, then share the resulting item. The secondary share-first path is deferred.

The currently proposed sharing methods are:

- specify another user
- password-protected extraction
- generate a public link

Text messages are not part of outward sharing. They remain part of the user's own stored transfer space.

When specifying another user inside the hosted instance, the current rule is single-recipient selection rather than multi-user fan-out.

For password-protected extraction, the current direction is to generate both:

- a retrieval link
- a corresponding extraction password

The sender shares these credentials with the intended recipient, who uses them to access and download the shared content.

The link and password should be presented together in the generation interface for convenience, but the product should treat them as credentials intended to be sent separately.

The current retrieval-page flow is:

- the recipient opens the retrieval link
- the first step is password entry
- after successful authentication, the page shows selected metadata about the shared content
- the page then provides a download button

## Role Model Direction

The current product context is a self-hosted multi-user instance.

The expected roles are:

- administrator user: usually the owner who deploys and controls the service
- regular users: friends or trusted collaborators with normal transfer capabilities

Regular users should still receive a complete transfer experience, including their own send-to-self workflow and recipient-targeted sharing, but they should not have access to server-level administration or instance configuration.

The administrator's normal transfer interface should remain the same as a regular user's. Administrative power should live in a separate server-management panel rather than altering the everyday transfer surface.

The server-management panel should include user disablement, storage visibility, and instance-level policy control.

The current direction is:

- administrators may disable or re-enable users
- administrators may view per-user storage usage
- administrators may impose storage limits
- confidentiality strategy should be governed centrally at the instance level rather than customized per user
- administrators may see device counts and limited device metadata for users, but may not manage user trust relationships
- the first admin-panel version should include overview, user and invitation controls, storage and limits, instance-level strategy controls, and system status

The accepted first-version admin-panel field direction is:

- overview may include recent 24-hour transfer activity alongside service health, user counts, device counts, storage, and invitation status
- user detail may include approval information and invitation provenance
- storage management may allow manual cleanup triggering in addition to limits and visibility
- the first strategy page should include core instance switches for invitation registration, recovery, live transfer, public links, and password extraction

## Identity And Trusted Device Direction

The current direction separates account identity from trusted-device access.

The working rules are:

- logging in proves who the user is, but does not by itself grant decryption access on a new browser
- each trusted browser instance should behave as its own device with an independent device key
- self-transfer content belongs to the account-level self space, while timeline origin still shows the source device name
- new devices should gain decryption access only through an already trusted device or a recovery path
- server-side control can invalidate future access for a removed device, but cannot affect content that was already downloaded locally
- administrators may manage instance-level operations, but cannot decrypt user content on behalf of users

The recommended first-version direction is:

- first login establishes the first trusted device for that user
- later devices require trusted-device approval or recovery
- clearing browser storage effectively removes trust from that browser and requires re-pairing
- some security behaviors around trust onboarding may be configurable, but the basic separation between login and trusted-device access should remain mandatory

The currently accepted first-version trusted-device flow is:

- new browsers log in first, but remain untrusted until approved or recovered
- trusted-device approval uses QR pairing as the main path
- short-code pairing exists as a fallback path
- recovery exists as a separate fallback when no trusted device is available
- recovery should rotate the recovery credential after successful use

The current admission model is invite registration plus approval:

- the administrator generates an invitation code
- the invited person registers using that code
- the administrator must still approve the account before full access is granted

Only administrators may generate invitation codes. Regular users cannot invite additional users.

Invitation codes should be single-use. They may have an expiration time, but the maximum allowed validity should not exceed four hours.

The public-link option is explicitly a convenience path rather than a strict end-to-end encrypted mode. The intended experience is that a recipient can open the link in a browser and immediately begin downloading or decrypting the shared content.

The current public-link direction is even more direct: opening the link should begin download with minimal or no extra presentation.

If a public link is invalid for any reason, the system should return a generic error page or direct HTTP error response without exposing extra information about the content.

## Interaction Direction

The default send-to-self page should be list-centric rather than form-centric.

The current direction is:

- a home page showing valid encrypted payloads for the current self identity
- a prominent upload or compose region for adding files or text
- an experience that can borrow from IM patterns, such as a running timeline or conversation-like list, as long as it still fits transfer-heavy actions like download, expiry, and file grouping

The interaction is now further clarified as follows:

- the IM-like event flow should only show currently valid payloads
- unavailable content such as expired items should be omitted from the main timeline
- a separate detailed list view should exist for expired items, self-destructed items, and other non-active transfer records
- the default composer should place text input and single-file sending next to each other, similar to a chat input with an adjacent plus button
- folder upload, very large files, and more complex transfer forms should move into a dedicated upload page rather than overload the default composer
- items in the event flow should show origin context: own-device items display the device name, while shared items display the sharing user

The accepted current main-timeline presentation direction is:

- the timeline uses a chat-like left-right split
- the right side represents content uploaded from the current device
- the left side represents content arriving from other devices or other users
- each item uses a circular avatar container
- device-origin items use a device icon inside that avatar container
- user-origin items use a user icon or user initial inside that avatar container
- the title row shows only the device or user name on the left and the timestamp on the right
- text items use a bubble-like presentation with a single-side confidentiality color accent and support expand/collapse when long
- file items use a file-card presentation showing icon, filename, format, and file size
- file-item confidentiality is expressed through the file icon background color
- file cards use a small colored status dot to represent rough remaining-validity state instead of explicit text countdowns
- the remaining-validity dot should use a green-only language with shape differences: a soft light-green filled dot for still-safe, a medium-green hollow dot for approaching expiry, and a darker thicker green ring for near-expiry
- clicking the file-card body starts download immediately
- a dedicated share button remains on the right side of the file card
- detailed inspection belongs in the history page rather than the active timeline
- folder and file-group items should share the same card skeleton as single-file items
- folder and file-group cards should use icon and title treatment that clearly indicate grouped content
- grouped-item secondary information should at least show item count and total size
- grouped items should use the same confidentiality color and validity-dot language as single files
- clicking the grouped-item card body should download the whole grouped object
- grouped-item details should not expand inline in the active timeline

History should lean toward user review rather than audit-heavy system inspection.

The detailed history page should act as a broader review and lookup surface rather than only a list of failures.

The accepted first-version history direction is:

- history includes completed records as well as invalidated or otherwise non-active records
- the page should provide search
- the first-version filters should at least include status and source type
- history entries should show a concise combination of title, content type, source, time, and current status
- opening a history entry should show fuller detail, including whether the content is still retrievable
- text-message history may be opened for full viewing unless later confidentiality policy restricts that behavior

For recipients, the main timeline should remain an active view rather than a complete archive.

The current invalidation presentation rules are:

- only currently valid items remain in the main timeline
- invalidated items should be removed from the main timeline rather than kept as long-lived grey placeholders
- if an item becomes invalid while the user is actively viewing or trying to use it, the product should show an immediate status message
- invalidated items should remain visible in the detailed history view
- history entries should show the specific invalidation reason for retained invalid items, such as expired, deleted by sender, or revoked by sender
- items removed by burn-after-read should not remain in history

Uploads and shares should both support selecting an effective validity period.

The current validity rules are:

- uploads can choose a file validity period
- the maximum upload validity is constrained by confidentiality level
- shares can choose a separate share validity period
- if the original file expires, all derived shares must also become invalid
- if the original file is manually deleted, all derived shares must also become invalid

The dedicated advanced upload page exists for cases where the lightweight default flow is unsuitable, including folder upload, oversized files, or other transfer forms that the default path cannot reliably handle.

Across the product, some security-related behaviors should be configurable rather than universally forced. The product should allow appropriate security options to be toggled when strictness would otherwise create practical friction in certain environments.

The advanced upload page should be entered intentionally rather than triggered automatically. If the lightweight default upload detects unsupported content or limits, it should show a text warning instead of silently redirecting the user.

Uploads should determine confidentiality policy at send time.

The current direction is:

- users choose a confidentiality level when uploading or sending
- the product provides a default level so the user does not need to choose every time
- burn-after-read is an optional setting that can be attached to the transfer policy
- each confidentiality level is expected to map to a different protection strategy rather than being a cosmetic label
- there are exactly three confidentiality levels
- the three levels are strategy groups that administrators may customize
- the product should still ship with a default built-in three-level configuration
- the default confidentiality level should itself be configurable
- confidentiality levels may not be disabled
- the lightweight default send surface should expose a simple confidentiality switch on the left side of the composer
- uploaded content may have its confidentiality level changed later
- recipients may not change the confidentiality level of received shared items
- later confidentiality changes to a source item should not automatically propagate into already derived shares
- confidentiality level names are fixed
- future newly created shares should use the source item's current confidentiality level at the time they are created
- the send-surface confidentiality switch applies to both text and file actions in the current send context
- all confidentiality levels may be sent without an extra confirmation step
- all confidentiality levels may choose an explicit validity period
- the default validity period varies by confidentiality level
- the maximum validity period varies by confidentiality level
- additional protective options remain separate options rather than being inherently tied to confidentiality level
- all confidentiality levels remain eligible for the lightweight send path
- confidentiality selection should not trigger extra risk-warning copy on each send

The working example levels are:

- secret
- confidential
- top secret

## Design Tensions To Resolve

- Speed vs privacy
- Local direct transfer vs relay convenience
- Simplicity vs advanced control
- One-time share vs reusable transfer spaces
- Broad universality vs product focus
- Browser convenience vs strong end-to-end key handling

## Later Baseline Notes

- Later accepted documents keep send-to-self as the product anchor and keep send-to-others distinct, but formalize stored transfer as the primary product and architecture center in `v1`.
- The deferred share-first path is now an explicit `v1` exclusion rather than merely a later possibility.
- User-targeted protected sharing is now understood as identity-bound sharing that requires recipient trusted-device public wrapping material; when that prerequisite is absent, the share is blocked rather than silently weakened.
- Live transfer remains in `v1`, but later accepted documents make it a distinct subsystem with explicit handoff into stored transfer rather than a hidden continuation of the same transfer lifecycle.
- The current working `v1` baseline should be read from `design/09-v1-architecture-boundary.md`, `design/15-implementation-architecture-baseline.md`, and the accepted implementation-planning notes.
