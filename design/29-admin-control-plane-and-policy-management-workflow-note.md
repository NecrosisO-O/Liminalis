# Liminalis Admin Control-Plane And Policy-Management Workflow Note

## Status

- Detailed implementation-planning note

## Purpose

This document defines the implementation-planning baseline for the `v1` admin control-plane workflows in `Liminalis`, especially invite management, account approval, enable or disable actions, policy editing, and operational visibility boundaries.

Its goal is to make the control-plane side concrete enough for later route, service, and permission planning without letting admin workflows drift into content-reading capability.

This note builds on:

- `design/10-system-module-boundaries.md`
- `design/23-identity-admission-and-session-baseline.md`
- `design/24-confidentiality-policy-engine-and-bundle-note.md`

## 1. Planning Goals

- keep admin workflows explicitly separate from user content access
- define the minimum `v1` control-plane actions and their business effects
- define policy-edit publication and validation workflow concretely
- preserve the boundary that admin role does not imply decryption rights

## 2. Control-Plane Scope

`v1` admin workflows should cover:

- invite creation and management
- pending-user approval management
- user enable or disable actions
- confidentiality-policy editing and publishing
- storage and system-state visibility at an operational level

`v1` admin workflows should not cover:

- user-content plaintext reading
- forced decryption on behalf of users
- full admin analytics beyond the agreed basics

## 3. Admin Surface Boundary

- admin routes, services, and authorization checks should remain explicit even when co-deployed with the main product runtime
- control-plane actions should call business owners such as identity or policy services rather than mutating unrelated tables ad hoc

## 4. Invite Management Workflow

### 4.1 Invite Creation

Admins may create invite codes.

Invite creation should capture at minimum:

- creator admin id
- issue time
- expiry time
- single-use state

### 4.2 Invite List Behavior

The admin surface should be able to show:

- active invites
- consumed invites
- expired invites

### 4.3 Invite Invalidation

- admins may invalidate an unused invite before its normal expiry

## 5. Pending User Approval Workflow

### 5.1 Pending Queue

The admin surface should show pending accounts awaiting approval.

At minimum, pending rows may include:

- username
- optional email
- registration time
- invite provenance

### 5.2 Approval Action

- approving a user changes admission state from `pending_approval` to `approved`
- the action should record approval metadata

### 5.3 Removal Or Rejection Baseline

- `v1` does not require a rich rejected-user lifecycle
- the control-plane may remove or refuse a pending account administratively without introducing a large retained rejection-state machine

## 6. User Enable / Disable Workflow

### 6.1 Disablement Action

- disabling a user blocks new ordinary product access
- disabling a user blocks new trusted-device establishment and new recovery completion
- existing sessions must stop granting normal product use after enforcement

### 6.2 Re-Enable Action

- re-enabling restores account-entry eligibility
- re-enabling does not itself create trust on any browser

### 6.3 Admin Visibility

The admin surface may show:

- enabled or disabled status
- approval status
- limited device-count metadata

## 7. Confidentiality Policy Management Workflow

### 7.1 Editing Surface Shape

The admin policy surface should follow the already accepted structure:

- one compact global header
- three fixed level tabs: `secret`, `confidential`, `top secret`

### 7.2 Global Header

The global header should include:

- default confidentiality level selector
- restore-defaults action

### 7.3 Level Tabs

Each level tab should expose only the accepted editable policy sections:

- lifecycle
- share availability
- user-targeted sharing
- password extraction
- public links
- live transfer

### 7.4 Fixed Rule Boundary

- fixed system rules must not appear as ordinary editable toggles

## 8. Policy Edit Validation Workflow

Before a policy edit becomes current, the admin workflow should:

1. validate the edited field set
2. surface validation errors clearly
3. refuse publication when invalid combinations are present

Validation must reject at minimum:

- defaults above maximums
- fallback paths that depend on disabled parent transport modes
- public-link defaults when public links are disabled
- share-mode defaults when the mode itself is disabled

## 9. Policy Publication Workflow

The accepted `v1` publication rule is:

- once validation succeeds, the policy edit publishes immediately
- publication creates a new current `PolicyBundle` version
- `v1` does not need draft or scheduled publication workflows

## 10. Policy History Visibility

The admin surface may show limited policy version history such as:

- level name
- bundle version
- updated time
- updating admin

Planning rule:

- historical policy versions are for operational reasoning and auditability, not for end users and not for retroactive object mutation

## 11. Restore Defaults Workflow

- restore defaults should create a new current `PolicyBundle` version using the built-in preset values
- restore defaults should not rewrite historical object snapshots

## 12. Storage And System-State Visibility

`v1` admin visibility may include:

- storage usage totals
- counts of users, invites, and active objects where appropriate
- background-job or cleanup health summaries
- system-state health visibility

Planning rule:

- this is operational metadata, not content inspection

## 13. Manual Cleanup And Operational Actions

`v1` may expose limited operational cleanup actions for:

- expired invites
- stale pending accounts where policy or admin process requires it
- failed or expired upload-session cleanup visibility
- background cleanup status where relevant

Planning rule:

- operational cleanup actions must still not expose decrypted user content

## 14. Admin Permission Boundary

- admin role allows control-plane actions only
- admin role does not allow decryption or content-body preview
- admin role does not bypass trusted-device or package-issuance boundaries for user content

## 15. Route And Service Boundary Guidance

For later implementation planning:

- admin routes should live under an explicit admin namespace
- admin handlers should delegate to identity, policy, and operational services rather than bundling business mutations directly in controller logic

## 16. Auditability Baseline

`v1` should leave room to record who performed control-plane actions such as:

- invite creation or invalidation
- user approval
- user disablement or re-enablement
- policy publication

This note does not require a heavy dedicated audit platform in `v1`, only durable attribution-ready business metadata.

## 17. Security Red Lines

Implementation planning should not allow these shortcuts:

- do not let admin control-plane views drift into content-reading views
- do not publish invalid policy combinations
- do not mutate policy bundles in place without versioning
- do not let admin disablement leave users with effectively unrestricted stale-session access indefinitely
- do not merge user-facing business routes and admin control routes into one ambiguous authorization surface

## 18. Follow-Up Planning Needed

The next planning work should still define:

- the exact admin route groups and permission middleware
- the operational data shape for storage and cleanup visibility
- the API planning for invites, approvals, disablement, and policy publication
- the implementation sequencing note that places core identity and policy editing before richer admin refinements
