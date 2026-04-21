# Liminalis Frontend Route And Bootstrap Architecture

## Status

- Active frontend planning note
- Builds on the accepted frontend shell strategy and existing backend route/bootstrap planning

## Purpose

This document defines the top-level frontend route and bootstrap architecture for `Liminalis`.

Its goal is to ensure that frontend routing follows the accepted identity, admission, trust, retrieval, admin, and live-transfer boundaries before detailed implementation begins.

This note stays above exact router-library code and concrete component structure. It defines:

- the top-level frontend route families
- how bootstrap determines the next allowed frontend shell
- how route guards and shell guards should behave
- how user-site and admin-site entry should relate
- which routes are public, authenticated, trusted-only, admin-only, or shell-specific

## 1. Planning Goals

- make shell entry and shell transitions deterministic from backend truth
- preserve the product rule that authenticated session and trusted-device access are distinct
- prevent ordinary product pages from being shown to pending, disabled, or untrusted browsers
- keep public-link routes separate from authenticated routes
- keep admin route entry separate from ordinary user routing
- define route families clearly enough that later implementation does not collapse state-driven routing into ad hoc page checks

## 2. Core Routing Principle

Frontend routing should be state-driven at the shell boundary.

Meaning:

- route selection at entry must follow backend bootstrap truth
- the frontend should not guess whether the user belongs in normal product use, trust establishment, or a blocked state from local heuristics alone
- shell-level route guards should use backend-derived state, not only client-side assumptions about session presence

## 3. Top-Level Frontend Sites

The accepted frontend topology is:

- user site
- admin site

The user site contains:

- `EntryShell`
- `AccessShell`
- `WorkspaceShell`
- `PublicLinkShell`

The admin site contains:

- `AdminShell`

Planning rule:

- `AdminShell` should not be treated as an internal route family inside the ordinary user site
- the admin frontend is a separate frontend site even if both sites share backend identity and design primitives

## 4. Top-Level User-Site Route Families

The safe high-level user-site route grouping for `v1` is:

- `/login`
- `/register`
- `/waiting`
- `/blocked`
- `/device/*`
- `/app/*`
- `/live/*`
- `/p/*` or equivalent public-link path family outside the authenticated app space

### 4.1 Why This Grouping Is Chosen

- entry routes remain distinct from authenticated trust-establishment routes
- trust-establishment routes remain distinct from ordinary product workspace routes
- public-link convenience delivery remains separate from authenticated product routing
- the route map stays aligned with the accepted backend route families and product state boundaries

## 5. Top-Level Admin-Site Route Families

The safe high-level admin-site grouping for `v1` is:

- `/login` for admin-site entry if a dedicated admin entry route is needed on that site
- `/admin`
- `/admin/invites`
- `/admin/approvals`
- `/admin/users`
- `/admin/policy`
- `/admin/system`

Planning rule:

- exact route names may be adjusted later for implementation convenience
- the important part is that admin control-plane routes live in the separate admin site and remain clearly control-plane scoped

## 6. Bootstrap Responsibility

Bootstrap answers the question:

- given the current browser session and local trust context, which frontend shell is allowed next

Bootstrap should determine at minimum:

- whether the browser has an authenticated account session
- whether the account is pending approval, approved, or disabled
- whether first trusted-device setup is required
- whether the current browser is trusted
- whether a recovery interruption is pending and must be resumed
- whether the user may enter the ordinary trusted workspace now

Planning rule:

- bootstrap is a shell-routing decision service, not a retrieval or trust-establishment action by itself

## 7. Bootstrap Decision Map

The accepted bootstrap decision map for the user site is:

1. no valid authenticated session
2. pending approval
3. disabled account
4. approved account with first-device setup required
5. approved account with recovery interruption pending
6. approved account with authenticated but untrusted browser
7. approved account with trusted browser

These should route as follows.

### 7.1 No Valid Authenticated Session

- allowed shells: `EntryShell`, `PublicLinkShell`
- default route: `/login`

### 7.2 Pending Approval

- allowed shell: `AccessShell`
- default route: `/waiting`
- ordinary `/app/*` routes must not render

### 7.3 Disabled Account

- allowed shell: `AccessShell`
- default route: `/blocked`
- ordinary `/app/*` routes must not render
- trust-establishment and recovery continuation must not restore ordinary product use while disabled

### 7.4 First Trusted-Device Setup Required

- allowed shell: `AccessShell`
- default route: `/device/setup`
- this state is for approved accounts with no existing trusted device yet

### 7.5 Recovery Interruption Pending

- allowed shell: `AccessShell`
- default route: `/device/recovery/rotated-codes`
- ordinary workspace entry must remain blocked until the interruption is acknowledged

### 7.6 Approved But Current Browser Untrusted

- allowed shell: `AccessShell`
- default route: `/device/pair`
- recovery remains an alternate route family inside `AccessShell`

### 7.7 Approved And Current Browser Trusted

- allowed shell: `WorkspaceShell`
- default route: `/app`

## 8. Shell Guard Rules

Each shell should have a shell-level guard based on bootstrap truth.

### 8.1 EntryShell Guard

- allowed when no authenticated session is present
- may also be shown when the user explicitly signs out or session expiry returns the browser to anonymous entry
- should redirect authenticated users through bootstrap rather than allowing stale entry-page use as the main product surface

### 8.2 AccessShell Guard

- allowed only for authenticated users who are not yet in ordinary trusted-product use
- should reject direct entry for ordinary trusted users and redirect them through bootstrap to `/app`
- should reject anonymous users and redirect them to `/login`

### 8.3 WorkspaceShell Guard

- allowed only for authenticated and trusted users in an ordinary permitted account state
- should reject pending, disabled, first-setup, recovery-interruption, and untrusted-browser states
- should redirect those states back through bootstrap to the appropriate `AccessShell` route

### 8.4 PublicLinkShell Guard

- should be reachable without authenticated user-site shell entry
- should not depend on user-site session state to render its initial route family
- may still optionally use authenticated context later for convenience bridges, but that must not change its anonymous-first shell model

### 8.5 AdminShell Guard

- allowed only for authenticated users with admin role on the separate admin site
- should reject anonymous users to the admin-site login entry
- should reject authenticated non-admin users with a controlled forbidden or redirect outcome rather than falling back to ordinary user-shell rendering on the same site

## 9. Route Families By Shell

### 9.1 EntryShell Route Family

- `/login`
- `/register`

### 9.2 AccessShell Route Family

- `/waiting`
- `/blocked`
- `/device/setup`
- first-device recovery-code interruption route family, whether setup-scoped or otherwise dedicated
- `/device/pair`
- `/device/pair/waiting`
- `/device/pair/approve`
- `/device/recovery`
- `/device/recovery/rotated-codes`

Planning rule:

- route names may later be normalized, but these flows must remain inside `AccessShell`

### 9.3 WorkspaceShell Route Family

- `/app`
- `/app/timeline`
- `/app/upload`
- `/app/history`
- `/app/search`
- `/app/items/:id`
- `/app/settings`

Planning rule:

- exact nested route detail remains later work
- the important accepted boundary is that ordinary trusted work lives under the `/app/*` family

### 9.4 LiveTransferModeShell Route Family

- `/live/start`
- `/live/:session`
- `/live/:session/join`
- explicit fallback transition into the ordinary stored-transfer flow

Planning rule:

- live transfer should remain a distinct frontend route family in the user site even when it is still part of the same overall authenticated product experience
- active live-transfer routing should not be silently hidden inside ordinary `/app/*` stored-transfer routes

### 9.5 PublicLinkShell Route Family

- `/p/:token` or equivalent public-link family

Planning rule:

- public-link delivery routes should remain visually and structurally outside `/app/*`

### 9.6 AdminShell Route Family

- `/admin`
- `/admin/invites`
- `/admin/approvals`
- `/admin/users`
- `/admin/policy`
- `/admin/system`

Planning rule:

- these live on the separate admin frontend site even if the visible route family still uses `/admin/*`

## 10. Default Landing Rules

The accepted default landing behavior is:

- anonymous user-site entry lands on `/login`
- trusted authenticated user-site entry lands on `/app`
- the default ordinary product landing should resolve to the self-space-centered workspace rather than a generic analytics dashboard
- public-link entry lands directly on the public-link route
- admin-site entry lands on the admin login or directly on `/admin` if a valid admin session already exists for that site

## 11. Workspace Default Route Rule

Inside `WorkspaceShell`, the default route should center on self-space.

Planning consequence:

- `/app` should resolve to the main self-space work surface, most naturally the active timeline or equivalent default workspace view
- the first ordinary trusted view should not be an admin-like dashboard or empty settings page

## 12. Recovery And Interruption Routing Rules

The frontend should preserve the special force-return behavior of recovery interruption states.

### 12.1 Recovery Entry

- approved but untrusted users may choose `/device/recovery`
- this remains distinct from normal pairing routes

### 12.2 Recovery Rotation Interruption

- if recovery succeeds and a rotated-code interruption is still pending, bootstrap must route back to `/device/recovery/rotated-codes`
- reloads during that interruption should reopen the same interruption rather than treating the flow as completed

### 12.3 No Ordinary Bypass

- the frontend must not allow `/app/*` entry while a recovery interruption acknowledgment is still required

## 13. Pairing Route Rules

The pairing route family should separate session creation from waiting and approval states.

Accepted high-level route split:

- `/device/pair`: start or restart pairing from the new-device side
- `/device/pair/waiting`: show QR and short-code session state while waiting for join or approval
- `/device/pair/approve`: trusted-device-side approval surface

Planning rule:

- QR-display waiting should not be collapsed back into the pair-start route once the session is active
- approval should remain a distinct surface because it belongs to the trusted-device actor and has different context requirements

## 14. Live Transfer Route Rules

Live transfer should remain inside the trusted user product route family while still being visibly distinct from stored-transfer pages.

Accepted direction:

- live-transfer entry and active sessions live under `/live/*`
- active live transfer uses `LiveTransferModeShell` inside the workspace experience
- live-transfer failures and explicit handoff to stored transfer should not silently masquerade as ordinary stored-transfer routes

## 15. Admin Entry And Return Rules

Because the admin frontend is a separate site, the frontend should preserve explicit transition rules between the two sites.

### 15.1 User-To-Admin Transition

- admin-capable users may use an explicit control-plane entry action from the user site
- that action should perform a site transition into the separate admin frontend rather than opening admin pages inside `WorkspaceShell`

### 15.2 Admin-To-User Transition

- the admin site should provide an explicit return path to the normal user workspace
- that return should move the user back into the user frontend site rather than embedding ordinary user views inside the admin shell

### 15.3 Role Failure Handling

- non-admin users must not be shown degraded admin-shell partial pages
- they should receive a controlled forbidden or redirect outcome on the admin site

## 16. Session Expiry And Revalidation Rules

The frontend should treat session loss as a shell boundary event.

Planning consequence:

- when the authenticated session expires, `AccessShell`, `WorkspaceShell`, and `AdminShell` should all fall back to their respective login-entry behavior
- this should not leave stale content visible under a broken shell
- revalidation should happen at shell entry and at meaningful protected route transitions, not only once at application startup

## 17. Route-State Ownership Principle

Top-level route ownership should follow domain and shell boundaries rather than page aesthetics.

Planning consequence:

- route families should align with accepted backend ownership boundaries
- frontend route grouping should not be driven only by which pages happen to look visually similar
- trust, retrieval, public-link, admin, and live-transfer routes should remain structurally legible in the frontend tree

## 18. Security And UX Red Lines

Frontend planning should not allow these shortcuts:

- do not treat authenticated session presence as enough to render `/app/*`
- do not place public-link routes inside the authenticated workspace route family
- do not collapse admin control-plane routing into ordinary user-site navigation
- do not let pending or disabled users reach trusted workspace frames and merely hide content panels inside them
- do not bypass recovery interruption acknowledgments through direct linking
- do not merge pairing-start, pairing-waiting, and trusted-device approval into one confused universal route

## 19. What This Note Does Not Yet Fix

This note does not yet define:

- exact nested route shapes inside `WorkspaceShell`
- exact URL naming for every detail page
- exact router implementation patterns
- exact data-loading strategy for route-level fetching
- exact admin-site authentication entry behavior under cross-site cookie constraints

These remain later frontend planning or implementation tasks.

## 20. Follow-Up Planning Priorities

The next frontend planning work should define at minimum:

- the fixed layout anatomy of each shell
- the main information architecture and navigation model of `WorkspaceShell`
- the global frontend state model that feeds shell guards and route guards
- the cross-site authentication behavior between the user site and the admin site
- the shared versus separate design-system layers across user and admin frontends
