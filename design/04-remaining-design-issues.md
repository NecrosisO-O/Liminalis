# Liminalis Remaining Design Issues

## Status

- Active checklist for the rest of the design phase
- Historical late-design checklist; the main accepted outcomes here have since been carried into architecture and implementation-planning documents

## Confirmed Boundary

- The first release is `web-only`
- Native desktop clients, native mobile clients, and external bot-style integrations are later expansions

## Remaining Issues To Resolve

### 1. Trusted-device state pages

- Resolved direction:
- the untrusted-device page should emphasize trusted-device approval as the main path
- recovery is a fallback path and should not be presented as an equally prominent primary button
- the new-device waiting page should show both QR pairing and short-code fallback
- the trusted-device approval page should confirm the new device before trust is granted
- login-alone messaging should clearly explain that account access does not yet grant decryption access on the new browser
- state-page wording should remain direct and non-technical, using device-trust language rather than cryptographic terminology

### 2. Recovery credential details

- Resolved direction:
- recovery should use a set of recovery codes rather than a single recovery phrase
- the recovery set should contain three codes
- each recovery code should contain 20 characters
- recovery codes should use only non-ambiguous letters and digits
- recovery codes should be shown in grouped segments for readability
- after recovery-code rotation, the continue action should be gated by a five-second countdown before the user may proceed
- recovery codes should be shown as a full set rather than as individually emphasized standalone items
- the first version should provide copy-all and download-text actions
- the first version does not need per-code copy actions
- old recovery codes should not be viewable again later; getting a new visible set means rotating to a new set
- rotated recovery codes should be shown on a strong interrupting page rather than a lightweight prompt or modal

- Remaining questions:

### 3. Live transfer rules

- Resolved direction:
- text messages are not part of online direct transfer
- text messages are not part of outward sharing
- online direct transfer does not need a strong product split between sending to another self device and sending to another user when both are confirmed peers in the same live session
- live transfer should use a create-session / join-session model
- the transport strategy should be peer-to-peer first with automatic relay fallback
- users should see lightweight transport-status labels without manually choosing the transport mode
- when live transfer fails, the product should guide users back to the normal stored-transfer flow
- the first peer-to-peer attempt should time out after about 10 seconds before relay fallback
- failed live transfer should prioritize "switch to normal transfer" as the main next action
- an unjoined live session should expire after about 5 minutes
- an established but inactive live session should end after about 10 minutes of inactivity
- live-transfer wording should stay direct, and device-joining language should avoid awkward phrasing like "the other device" when not needed

- Remaining questions:

### 4. Shared-item invalidation presentation

- Resolved direction:
- the recipient main timeline should only show currently valid items
- invalidated items should leave the main timeline rather than remain as long-lived placeholders
- if invalidation happens during active viewing or use, the user should get an immediate status message
- invalidated items should remain visible in detailed history
- history should show the concrete invalidation reason, such as expired, deleted by sender, revoked by sender, or burned after reading

### 5. Detailed history page

- Resolved direction:
- history should include completed records as well as invalidated and other non-active records
- history should provide search
- the first-version filters should at least include status and source type
- entries should show title, content type, source, time, and current status
- entry detail should clearly show whether the content is still retrievable
- text-message history may be opened for full viewing unless later confidentiality policy restricts that behavior

### 6. Admin panel field-level detail

- Resolved direction:
- the overview page may include recent 24-hour transfer activity in addition to health, counts, storage, and invitation status
- user detail may include approval metadata and invitation provenance
- storage management may allow manual cleanup triggering
- the first strategy page should include invitation registration, recovery, live transfer, public links, and password extraction as core switches
- admins may see limited device metadata without controlling trust relationships

### 7. Confidentiality policy pass

- Resolved direction:
- confidentiality should use exactly three levels
- the levels are best understood as three strategy groups rather than three hard-coded immutable behaviors
- administrators may customize the concrete strategy of each level
- the product should still provide a default built-in configuration for the three levels
- the default confidentiality level should itself be configurable
- confidentiality levels may not be disabled
- the default send surface should expose a lightweight confidentiality switch on the left side of the composer
- uploaded content may have its confidentiality level changed later
- recipients may not change the confidentiality level of received shared items
- derived shares should not automatically inherit later confidentiality changes made to the source item
- confidentiality level names are fixed rather than administrator-renamable
- future newly created shares should use the source item's current confidentiality level at the time they are created
- the send-surface confidentiality switch applies to both text and file actions in the current send context
- all confidentiality levels should be sendable without an extra confirmation step
- all confidentiality levels should allow an explicit validity period to be chosen
- the default validity period should vary by confidentiality level
- the maximum validity period should vary by confidentiality level
- additional protective options should remain additional options rather than being inherently bound to confidentiality level
- all confidentiality levels should remain eligible for the lightweight send path
- confidentiality selection should not trigger extra risk-warning copy on each send
- confidentiality policy now also covers lifecycle, sharing, password extraction, public links, live transfer, burn-after-read, trusted-device recovery behavior, trusted-device display/search visibility, and the admin-facing policy page structure

- Remaining questions:
- Define how, if at all, the deferred share-first entry path should participate in confidentiality policy

## Suggested Resolution Order

1. Trusted-device state pages
2. Recovery credential details
3. Live transfer rules
4. Shared-item invalidation presentation
5. Detailed history page
6. Admin panel field-level detail
7. Confidentiality policy pass

## Later Baseline Notes

- The trusted-device, recovery, live-transfer, history, admin, and confidentiality directions recorded here have now been expanded and stabilized in the accepted later notes.
- In particular, later documents now make `consumed` share outcomes explicit, separate ordinary pairing from recovery restoration, and formalize the confidentiality-policy engine and admin publication model.
- This file should now be read as a late-design checklist snapshot rather than the current canonical baseline.
