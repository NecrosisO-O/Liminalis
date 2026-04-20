# Liminalis Trusted-Device Pairing And Recovery Protocol Note

## Status

- Detailed implementation-planning note

## Purpose

This document turns the accepted trusted-device direction into a protocol-level implementation-planning note for `Liminalis` `v1`.

Its goal is to define how browser trust is established, how a new device is paired, how short-code fallback should work, how recovery restores access, and how these flows interact with the key-and-access model without starting code.

This note stays above algorithm and API schema detail. It defines roles, steps, state transitions, trust boundaries, and the recovery-credential semantics needed before implementation.

## 1. Planning Goals

- preserve the rule that login proves account identity but not decryption access
- make the first trusted-device establishment explicit
- make QR pairing the primary trust-establishment path for later devices
- keep short-code pairing as a usable fallback rather than a second-class dead-end
- preserve recovery as a real restoration path into the same trusted-access domain
- avoid silently bypassing older-content visibility rules during ordinary pairing
- make the recovery flow understandable in the product without exposing cryptographic jargon

## 2. Main Roles

### 2.1 Account Session

- Represents authenticated account identity after login.
- Is necessary before trusted-device approval or recovery begins.
- Is not sufficient to unlock protected content by itself.

### 2.2 Existing Trusted Device

- A currently trusted browser instance for the same user.
- Can approve and authorize a new device.
- Can participate in QR or short-code pairing.

### 2.3 New Untrusted Device

- A browser instance that has logged in but has not yet gained trusted-device status.
- May enter pairing flow or recovery flow.
- Must not receive protected-content access material until the trust flow completes successfully.

### 2.4 Recovery Flow Actor

- The same account holder acting from an untrusted device when no approved trusted device is available.
- Uses recovery credentials to restore trust.

### 2.5 Trust Coordination Service

- A backend coordination role inside the main backend application.
- Tracks onboarding state, pairing sessions, expiry, approval outcome, and recovery rotation outcome.
- Must not become a plaintext holder of raw user access roots.

## 3. Core Terms

This note builds on `design/17-key-and-access-architecture-note.md`.

### 3.1 DeviceIdentityKey

- The per-device key identity generated in the browser for one trusted browser instance.
- Used to bind trust approval to that specific device instance.

### 3.2 Pairing Session

- A short-lived onboarding session connecting one logged-in untrusted device with one already trusted device.
- Exists only to coordinate trust approval and the transfer of wrapped trust material.

### 3.3 Pairing Approval Package

- The wrapped user-scoped access material and trust-binding output issued by the existing trusted device for the new device after confirmation.
- Allows the new device to enter the ordinary trusted-device domain.

### 3.4 Recovery Restoration Package

- The wrapped access restoration material produced through the recovery flow.
- Allows the recovering device to enter the same long-term trusted-access domain as other trusted devices.

### 3.5 RecoveryCredentialSet

- The current set of visible recovery credentials for the user.
- `v1` uses three recovery codes in one set.
- Any one valid code from the current set is sufficient to complete recovery.
- A successful recovery rotates the entire set immediately, invalidating the used code and all unused sibling codes from that set.

## 4. Recovery-Credential Decision

This note fixes the previously ambiguous recovery-credential semantics.

### 4.1 Adopted Rule

- `v1` keeps three recovery codes rather than collapsing to one code.
- Any one currently valid code from the current set may complete recovery.
- The whole set rotates immediately after a successful recovery.

### 4.2 Why This Direction Is Chosen

- It preserves the already accepted product direction that recovery uses a set of codes rather than one long recovery phrase.
- It preserves user redundancy: the three codes may be stored in different places.
- It avoids the awkwardness of showing three grouped values that all have to be entered together, which would functionally behave like one longer code.
- It remains simpler than managing a larger backup-code bank or per-code lifecycle UI in `v1`.

### 4.3 Product Consequence

- The recovery UI should explain that any one code works.
- The product does not need per-code copy actions or per-code remaining-use management in `v1`.
- After one successful recovery, the entire visible set is replaced by a new set on the strong interrupting rotation page.

## 5. Trust State Model Mapping

This note adopts the state families already accepted in `design/12-flow-and-state-model.md` and gives them protocol meaning.

### 5.1 Device Onboarding States

- `untrusted`: logged in but not trusted
- `awaiting_pair`: new device is waiting to be paired with an existing trusted device
- `awaiting_approval`: the trusted device has opened the approval flow and must still confirm the specific new device
- `trusted`: the device has received and stored the wrapped trust material and can participate in protected access
- `rejected`: approval was explicitly denied
- `expired`: the pairing session timed out or became unusable

### 5.2 Recovery States

- `untrusted`: logged in but not trusted
- `awaiting_recovery`: the recovery UI is active and waiting for a valid recovery code
- `recovered`: recovery has succeeded and new recovery credentials must be acknowledged
- `trusted`: the recovered device is now part of the trusted-device domain

### 5.3 Mapping Rule

- onboarding and recovery remain separate entry paths
- both converge on the same `trusted` long-term state
- recovery does not create a weaker or special trusted-device category

## 6. First Trusted Device Establishment

The first login for a newly approved account should establish the first trusted device automatically.

### 6.1 Preconditions

- the user account is authenticated
- the user is approved for product access
- the account has no existing trusted device yet

### 6.2 Flow

1. the browser generates `UserDomainAccessRoot`
2. the browser generates `UserRecoveryRoot`
3. the browser generates the device's `DeviceIdentityKey`
4. the browser derives the first trusted-device registration package
5. the server records the device as trusted only after receiving the expected wrapped registration material
6. the system creates the first `RecoveryCredentialSet`
7. the product shows the recovery-code interruption page before ordinary use continues

### 6.3 Planning Rules

- first-device establishment should not require a second already trusted device
- recovery credentials must be shown at first setup because later retrieval of old codes is not allowed
- the continue action after first display should remain gated by the accepted countdown rule

## 7. New Device Pairing Overview

The default later-device flow is:

1. login on the new device
2. enter the untrusted-device state
3. begin pairing through QR first or short-code fallback
4. let an existing trusted device inspect and confirm the specific new device
5. issue wrapped trust material for the new device
6. mark the new device as trusted

### 7.1 Pairing Design Rules

- the new device must never become trusted before explicit confirmation on the trusted device
- the trusted device must be shown enough context to avoid approving the wrong browser instance
- ordinary pairing must not automatically broaden old-content visibility beyond each object's `AccessGrantSet`

## 8. QR Pairing Protocol Shape

QR pairing is the primary trust-establishment path.

### 8.1 New Device Side

1. the untrusted device starts a pairing session
2. the browser generates its `DeviceIdentityKey` locally if it does not already exist for this device instance
3. the backend issues a short-lived pairing session record
4. the new device displays a QR code containing a pairing session reference and proof material sufficient for the trusted device to join the correct session

### 8.2 Existing Trusted Device Side

1. the trusted device scans the QR code
2. the trusted device resolves the pairing session and fetches the new-device attestation summary
3. the trusted device shows a confirmation page with visible non-cryptographic device context
4. the trusted device explicitly approves or rejects the request

### 8.3 Approval Output

On approval:

1. the trusted device creates or authorizes the `PairingApprovalPackage`
2. the package binds the user-scoped ordinary access material to the new device's `DeviceIdentityKey`
3. the package is returned through the trust coordination service to the new device
4. the new device stores the wrapped trust material locally
5. the device moves to `trusted`

On rejection:

- the new device moves to `rejected`
- no wrapped trust material is issued

### 8.4 QR Pairing Expiry

- a pairing session should expire quickly if not scanned or approved
- expiry should force the untrusted device back to a restartable state rather than leaving indefinite waiting sessions

## 9. Short-Code Pairing Protocol Shape

Short-code pairing exists so trust approval still works when QR scanning is inconvenient.

### 9.1 New Device Side

1. the new device starts or reuses a pairing session
2. the backend issues a short-lived short code bound to that pairing session
3. the new device shows the short code on the waiting page

### 9.2 Existing Trusted Device Side

1. the trusted device enters the short code manually
2. the backend resolves the matching pairing session
3. the trusted device loads the same confirmation surface used by QR pairing
4. the trusted device explicitly approves or rejects the new device

### 9.3 Short-Code Security Rule

- short-code entry must not be enough by itself to trust the device
- the trusted device must still fetch and confirm device context before approval
- the code lifetime should stay short enough to reduce accidental or malicious reuse

## 10. Visible Device Context Requirements

The trusted-device approval page should confirm the new device before trust is granted.

At minimum, the trusted device should see:

- a user-friendly device label proposed by the new device or derived from browser context
- a coarse browser or platform summary when available
- recent login time for the untrusted session
- approximate session-origin context such as IP-derived region if the product later chooses to expose it

Planning rule:

- device context should help the user avoid approving the wrong device without turning the UI into a technical diagnostics screen

## 11. Trust-Material Delivery Rules

### 11.1 Server Boundary

- the server may coordinate, relay, and persist wrapped package forms
- the server must not persist raw `UserDomainAccessRoot` or raw `UserRecoveryRoot` in plaintext form
- the server must not grant trust solely because a user is authenticated

### 11.2 New Device Activation Rule

- a new device becomes `trusted` only after it has both:
  - received the approved wrapped trust material
  - successfully stored the local trust state needed for future protected access

### 11.3 Failure Rule

- if wrapped trust-material delivery fails partway through, the device must remain untrusted and the session must be restartable

## 12. Older-Content Visibility And Pairing

Ordinary pairing and recovery intentionally behave differently.

### 12.1 Ordinary Pairing Rule

- newly paired devices gain ordinary trusted-device status
- they may access historical protected objects only where the relevant `AccessGrantSet` ordinary visibility mode allows it
- pairing must not rewrite historical object access packages in a way that bypasses `owner_device_snapshot` or `recipient_device_snapshot` restrictions

### 12.2 Recovery Rule

- recovery may restore historical protected access through recovery escrow packages
- this remains true even when ordinary newly paired devices would not automatically gain that older access
- this difference is intentional and should be documented as part of the recovery contract

## 13. Recovery Protocol Shape

Recovery is the fallback path when no trusted device is available.

### 13.1 Preconditions

- the user is authenticated
- the device is not trusted yet
- the account has an active `RecoveryCredentialSet`

### 13.2 Recovery Attempt Flow

1. the user enters one recovery code from the current set
2. the backend verifies that the code matches the current active set and has not already been invalidated by prior successful rotation
3. the browser generates or finalizes the device's `DeviceIdentityKey`
4. the recovery flow authorizes access to `UserRecoveryRoot`
5. the system issues the `RecoveryRestorationPackage` for the recovering device
6. the device stores the wrapped trust material locally
7. the system rotates the full `RecoveryCredentialSet`
8. the recovery UI moves to the strong interruption page showing the new set
9. after acknowledgment, the device becomes `trusted`

### 13.3 Recovery Rotation Rule

- rotation happens immediately after successful recovery, before the user resumes ordinary product use
- the old set becomes entirely invalid as soon as rotation completes
- old recovery codes must not be viewable later

Recovery-rotation durability rule:

- after successful recovery, the newly rotated recovery-code set must remain re-displayable inside the current recovered session until the user finishes the interruption flow
- if the browser reloads or the interruption page is reopened before the session ends, the same newly rotated set should be shown again rather than silently generating another replacement set
- the user should not be forced back onto the now-invalid old recovery set because of a browser crash after rotation has already committed

### 13.4 Recovery Failure Rule

- invalid code entry must not disclose which specific property failed
- the system may count failed attempts for abuse handling
- the product wording should remain direct and non-technical

## 14. Recovery-Code Generation And Presentation Rules

### 14.1 Generation Rules

- each set contains exactly three recovery codes
- each code is 20 characters long
- codes use only non-ambiguous letters and digits
- codes should be grouped for readability

### 14.2 Display Rules

- first issuance and post-recovery rotation should both use a strong interrupting page
- the page should offer copy-all and download-text actions
- `v1` does not need per-code copy actions
- the user should be told clearly that any one code can recover the account on an untrusted device

### 14.3 Continue-Gating Rule

- after recovery-code rotation, the continue action should remain disabled for the accepted countdown period
- the same gating rule should apply to the initial first-device recovery-code display if the product keeps the same interruption pattern there

## 15. Device Loss, Browser Reset, And Re-Establishment

- clearing browser storage should force that browser instance back into the untrusted flow
- a previously trusted physical machine whose browser state is lost should be treated as a new untrusted device instance
- re-establishment may then proceed through ordinary pairing or recovery
- prior trust on a wiped browser instance should not be assumed to survive local key loss

## 16. Revocation And Disablement Boundaries

- disabling a user account should block new trust establishment and new recovery completion
- removing or invalidating one trusted device should not by itself erase other trusted devices
- trust-management UI beyond the already accepted visibility scope may remain limited in `v1`, but the protocol model should allow individual device invalidation later

## 17. Security Red Lines

Implementation planning should not allow these shortcuts:

- do not treat successful login as equivalent to trusted-device establishment
- do not allow QR scan or short-code entry to auto-approve without a trusted-device confirmation step
- do not let ordinary pairing bypass older-content visibility restrictions
- do not reduce recovery to a weaker non-historical access tier
- do not keep old recovery-code sets valid after successful recovery
- do not expose raw user trust roots to the server in plaintext form

## 18. Follow-Up Planning Needed

The next notes should still define:

- exact pairing-session record fields and expiry rules
- exact attestation fields for visible new-device confirmation
- exact rate-limit and abuse-handling rules for pairing and recovery
- exact local-storage assumptions for wrapped trust material in the browser
- the detailed `AccessGrantSet` update behavior triggered by device invalidation, pairing, and recovery
