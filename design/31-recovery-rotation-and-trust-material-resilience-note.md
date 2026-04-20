# Liminalis Recovery Rotation And Trust-Material Resilience Note

## Status

- Detailed implementation-planning note

## Purpose

This document refines the resilience behavior for recovery-code rotation and local trust-material handling in `Liminalis` `v1`.

Its goal is to make recovery and local trust-material behavior robust enough for implementation planning without changing the already accepted security model.

This note builds on:

- `design/18-trusted-device-pairing-and-recovery-protocol-note.md`
- `design/23-identity-admission-and-session-baseline.md`

## 1. Planning Goals

- make recovery rotation durable across reloads inside the recovered session
- define the minimum session-local rules for re-showing the newly rotated recovery set
- make logout versus trusted-device-local-state behavior explicit
- define failure handling around local trust-material storage

## 2. Recovery Rotation Durability Rule

After successful recovery and rotation:

- the newly rotated recovery-code set must remain bound to the current recovered session until the interruption flow is finished
- reopening or reloading that interruption page inside the same recovered session should show the same already-rotated set again
- the system must not generate a fresh extra set merely because the user refreshed the page before acknowledging the first rotated set

## 3. Re-Display Contract

The server-side coordination state should preserve enough metadata to re-display the current rotated set safely within that recovered session.

Planning rule:

- re-display within the current recovered session is allowed
- later retrieval of old or already-dismissed recovery sets remains disallowed

## 4. Acknowledgment Rule

- the device should not become fully `trusted` for ordinary use until the post-recovery interruption flow is acknowledged
- acknowledgment closes the special re-display window for that rotated recovery set

## 5. Crash And Reload Rule

If the browser crashes or reloads after rotation has committed but before acknowledgment:

- the user should return to the same rotated recovery-code interruption flow
- the user should not be forced to use an already invalidated old set
- the system should not silently continue to normal product use without recovery-code acknowledgment

## 6. Local Trust-Material Storage Rule

- trusted-device local material should be considered durable browser-local state
- a device is not fully trusted until required wrapped trust material is stored successfully
- if local storage of trust material fails, the trust flow should remain restartable rather than half-activated

## 7. Logout Rule

- ordinary logout invalidates the account session only
- ordinary logout does not automatically delete trusted-device local material
- deleting trusted-device local material should remain a separate explicit action

## 8. Browser-Reset Rule

- if browser storage is cleared, the browser instance should lose local trust material and re-enter the untrusted flow
- prior account session state does not restore trusted-device status by itself

## 9. Disablement Interaction Rule

- if the account is disabled during a pending recovery or trust-material interruption flow, normal product entry should remain blocked after enforcement
- the control-plane disablement rule does not need to retroactively revalidate the already rotated recovery set, but it must block the resumed ordinary product session

## 10. Security Red Lines

Implementation planning should not allow these shortcuts:

- do not generate extra recovery-code rotations merely because the user refreshed the interruption page
- do not allow ordinary product entry before the rotated recovery set has been acknowledged
- do not let account logout masquerade as deletion of local trusted-device material
- do not activate trust on a device whose local wrapped trust material was not stored successfully

## 11. Follow-Up Planning Needed

The next planning work should still define:

- the exact recovered-session marker or recovery-interruption state record
- the exact browser-local storage contract for trusted-device material
- the settings/security UX for removing trusted access from this browser
- the implementation sequencing note that places recovery resilience after core trusted-device setup but before final security UX polishing
