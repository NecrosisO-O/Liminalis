# Liminalis Identity, Admission, And Session Baseline

## Status

- Detailed implementation-planning note

## Purpose

This document defines the `v1` baseline for account identity, invite-based admission, approval gating, user enablement state, and browser session behavior.

Its goal is to complete the foundation-planning set before coding so that account login, pending approval, admin approval, disabled-user behavior, and trusted-device entry conditions all follow one explicit model.

This note complements but does not replace the trusted-device planning documents. It defines account entry and session semantics, while trusted-device documents define decryption-access establishment after login.

## 1. Planning Goals

- keep account identity separate from trusted-device decryption access
- make invite registration and approval gating explicit
- define the minimum user-account state model for `v1`
- define browser session semantics without adding unnecessary auth complexity
- define how disabled and pending accounts behave at login time
- keep `v1` free of SSO, federation, and email-dependent recovery assumptions

## 2. Baseline Identity Model

### 2.1 Account Identifier Model

The accepted `v1` account identifier model is:

- `username` is the required unique login identifier
- `email` is optional profile or contact metadata, not a login identifier

### 2.2 Why This Model Is Chosen

- it keeps `v1` independent from email delivery and verification dependencies
- it fits the already accepted recovery model, which depends on trusted-device and recovery-code flows rather than email reset
- it keeps the first version's login surface and uniqueness rules simpler

### 2.3 Consequences

- login uses `username + password`
- registration requires `invite code + username + password`
- `email`, when present, should not be required to sign in

## 3. Non-Goals For `v1` Identity

`v1` should not take on these identity features as first-class requirements:

- SSO
- federation
- email-based password reset flows
- multi-identifier login using either `username` or `email`
- social login

## 4. Core Identity Objects

### 4.1 UserAccount

Represents instance membership and account identity.

At minimum it should carry:

- stable user id
- unique username
- optional email
- password-verifier material
- admission state
- enabled or disabled state
- admin or regular-user role
- creation and approval timestamps

### 4.2 InviteCode

Represents the right to register one account into the instance.

At minimum it should carry:

- invite id
- invite code value or secure verifier
- creator admin id
- issue time
- expiry time
- single-use consumption state
- optional provenance note if later needed

### 4.3 Session

Represents an authenticated browser account session.

At minimum it should carry:

- session id
- user id
- issue time
- expiry or idle-expiry data
- last activity time
- session validity status

## 5. User Admission State Model

`v1` should keep a minimal explicit admission state family.

### 5.1 Admission States

- `pending_approval`
- `approved`

### 5.2 Separate Enablement State

Enablement should remain distinct from admission.

- `enabled`
- `disabled`

### 5.3 Why These Are Separate

- approval answers whether the account has been admitted into the instance
- enablement answers whether an admitted account is currently allowed to use the instance
- this separation avoids overloading one flag with two different meanings

## 6. Effective Login Eligibility

For planning purposes, account login eligibility should be interpreted from both state families.

### 6.1 Pending Account

- a `pending_approval` account may authenticate successfully into the waiting-for-approval surface
- even if authentication succeeds, the account must not gain product access beyond the waiting-for-approval surface

### 6.2 Approved And Enabled Account

- an `approved + enabled` account may enter the normal post-login flow

### 6.3 Approved But Disabled Account

- a `disabled` account must not keep or gain ordinary product access
- existing sessions should become invalid for normal use after disablement is enforced

## 7. Accepted Waiting-Screen Behavior

The accepted `v1` behavior for pending users is:

- after successful registration, the user may have an authenticated account session
- while still `pending_approval`, that user sees only the waiting-for-approval screen
- the user cannot use the actual transfer product surfaces yet

### 7.1 Why This Matters

- it matches the existing accepted product direction
- it allows a coherent post-registration user flow without pretending approval has already happened

## 8. Registration Flow Baseline

### 8.1 Preconditions

- the user has a valid unused invite code

### 8.2 Registration Input

`v1` registration should require:

- invite code
- username
- password

`v1` registration may additionally accept:

- optional email

### 8.3 Registration Output

Successful registration should:

1. consume the invite code
2. create the `UserAccount` in `pending_approval`
3. not require automatic login by default

Recommended `v1` default:

- registration should complete without automatic login
- the new pending user should then log in explicitly and be routed to the waiting-for-approval surface

### 8.4 Registration Rules

- invite codes are single-use
- invite-code expiry must not exceed the already accepted upper limit
- username uniqueness must be enforced instance-wide

## 9. Approval Flow Baseline

### 9.1 Admin Approval

An administrator may approve a pending account.

Approval should:

1. change admission state from `pending_approval` to `approved`
2. record approval metadata
3. allow the user to enter the ordinary post-login flow on the next eligible session check

### 9.2 Admin Rejection In `v1`

`v1` does not need a complex rejected-account workflow unless later planning adds one.

Recommended baseline:

- pending accounts are either approved later or remain pending until explicitly removed by admin action

## 10. Enable / Disable Baseline

### 10.1 Disablement Rule

An administrator may disable an approved user.

Disablement should:

- block new normal product access
- block new trusted-device establishment and recovery completion
- cause existing sessions to stop granting ordinary product use after enforcement

### 10.2 Re-Enable Rule

An administrator may re-enable a disabled user.

Re-enable should:

- restore ordinary account entry eligibility
- not by itself create a trusted-device state on a new browser

## 11. Role Model Baseline

### 11.1 Roles

`v1` only needs:

- `admin`
- `regular_user`

### 11.2 Role Boundary

- role determines access to admin control-plane surfaces
- role does not determine decryption authority over user content
- admins use the same everyday transfer surface as regular users for their normal user behavior

## 12. Session Baseline

### 12.1 Session Type

`v1` should use secure cookie-backed sessions.

Session timing baseline:

- absolute session expiry: 30 days
- idle session expiry: 7 days

### 12.2 Session Meaning

A valid session means:

- the browser is authenticated as an account identity

A valid session does not mean:

- the browser is a trusted device
- the browser can automatically decrypt protected content

### 12.3 Session Scope

- one browser may hold an authenticated account session while still remaining untrusted for protected content access
- trusted-device establishment happens after or alongside authenticated session entry according to the trusted-device planning flows

## 13. Post-Login Routing Baseline

After successful session establishment, routing should depend on account state and trust state.

### 13.1 Pending Approval

- route to waiting-for-approval surface only

### 13.2 Approved But Untrusted Device

- route to untrusted-device entry flow
- the user may begin pairing or recovery
- the user must not receive normal protected-content access yet

### 13.3 Approved And Trusted Device

- route to the normal product experience

### 13.4 Disabled User

- route to a blocked account message or fail the session check in a controlled way

## 14. First Login Behavior

For a newly approved account with no trusted devices yet:

- the first eligible login should start first trusted-device establishment
- this remains separate from the account-session layer, even though it happens in the same overall user journey

## 15. Password Baseline

### 15.1 Authentication Password

- `v1` uses a local password for account authentication
- password-verifier storage must use a modern password-hashing approach

### 15.2 Separation Rule

- account password is not the same thing as password-extraction credentials
- account password is not the same thing as trusted-device recovery codes

## 16. Session Invalidation Rules

### 16.1 Normal Logout

- logout invalidates the current browser session
- logout should not automatically remove trusted-device state from local storage
- removal of trusted-device local access should remain a separate explicit user action such as removing trusted access from this browser

### 16.2 Disablement Invalidation

- if a user becomes disabled, existing sessions should stop authorizing normal product use after the next enforcement check

### 16.3 Password Change Consideration

`v1` may defer advanced password-change-wide-session-revocation behavior, but should leave room for it later.

## 17. Admin Visibility And Control Boundary

Identity and admission data may be visible to admins where operationally appropriate, including:

- username
- optional email
- approval metadata
- invitation provenance
- enabled or disabled state

Admins must still not gain decryption rights or protected-content reading rights through identity administration.

## 18. Security Red Lines

Implementation planning should not allow these shortcuts:

- do not treat login session state as trusted-device access
- do not let `email` become an implicit required dependency for `v1`
- do not allow pending accounts into normal transfer surfaces
- do not leave disabled accounts with durable unrestricted product access through stale sessions
- do not mix account-auth password semantics with password-extraction or recovery credentials
- do not let admin role imply user-content decryption capability

## 19. Follow-Up Planning Needed

The next planning work should still define:

- the exact session expiry and idle-timeout rules for `v1`
- the exact waiting-for-approval and blocked-account page behavior
- the eventual canonical fold-back of these accepted identity rules into broader implementation planning summaries
