# Liminalis Frontend Build Work Plan

## Status

- Active frontend planning note
- Defines the execution plan for later frontend work without authorizing implementation by itself

## Purpose

This document defines the work plan that should guide later frontend construction for `Liminalis`.

Its goal is to ensure that frontend implementation proceeds in a disciplined order, grounded in the accepted design and backend reality rather than in isolated page building.

This note does not authorize coding by itself. It records:

- the execution principles for frontend work
- the mandatory read-before-build workflow for every frontend part
- the phase order for user-site and admin-site construction
- the expected deliverables and verification approach for each phase

## 1. Frontend Execution Principles

- do not begin frontend implementation until the user gives an explicit start instruction
- preserve accepted design-phase and implementation-planning decisions instead of reinterpreting them during UI work
- use real backend contracts, state semantics, and permission boundaries as the basis for frontend implementation
- build the frontend in shell, state, and object-model order rather than as disconnected pages
- keep user-site and admin-site boundaries explicit throughout execution
- treat timeline as the primary user product surface and build around it accordingly

## 2. Accepted Frontend Technology Stack

The accepted frontend technology stack is:

- monorepo workspace structure under `apps/*`
- `apps/web` as the ordinary user site
- `apps/admin` as the separate admin site to be added
- React 19 for UI rendering
- TypeScript for all frontend code
- Vite for development server and production bundling
- React Router for routing
- TanStack Query for server-state fetching, caching, invalidation, and request lifecycle handling
- plain React state for local UI state and shell-local interaction state
- a project-local component and styling system rather than a heavyweight external UI component framework
- `clsx` for class composition
- Vitest for unit/component-level test execution
- Playwright for end-to-end browser coverage
- ESLint as the baseline linting layer

### 2.1 Technology-Selection Rule

- prefer the tools already present in the repository over introducing parallel alternatives
- do not introduce Redux, Zustand, MobX, or another global-state framework unless a later concrete implementation need proves React state plus TanStack Query insufficient
- do not introduce a heavyweight visual component library as the primary UI layer
- do not introduce CSS-in-JS as the main styling strategy by default

### 2.2 Styling Direction

The accepted styling direction is:

- styling should be implemented with project-local CSS and design-token-driven class conventions rather than through a third-party visual framework
- light and dark theme support must be built into that styling system from the start
- existing design-phase visual semantics, especially confidentiality color meaning and timeline object treatments, must remain preserved

### 2.3 State-Management Direction

- backend-backed state should live in TanStack Query
- route and shell decision state should be derived from bootstrap and related backend truth
- ephemeral UI state should remain in local component state or shell-local React context when truly shared
- the frontend should avoid inventing a second competing client-side source of truth for lifecycle, trust, retrieval, or policy state

### 2.4 Routing Direction

- React Router is the accepted routing layer for both user and admin sites
- shell boundaries, access gating, and bootstrap-driven redirects should be implemented through router structure plus shell guards rather than through ad hoc page-level checks

### 2.5 Testing Direction

- Vitest should cover utility logic, formatting logic, route-guard helpers, and focused component behavior
- Playwright should cover the main user-visible flows once the relevant surfaces exist
- testing should follow the same phase order as implementation rather than attempting full-suite coverage before the shells and main flows exist

## 3. Mandatory Read-Before-Build Workflow

For every frontend area, the following workflow is mandatory before implementation begins.

1. read all relevant design documents in full
2. read all relevant backend modules in full
3. extract the exact state model, route model, object vocabulary, visible metadata limits, and action boundaries
4. identify error cases, invalid states, and no-bypass constraints
5. only then define the frontend implementation shape for that area
6. implement
7. verify against both design intent and backend behavior

Planning rule:

- no frontend part should be implemented from memory or from partial prior discussion alone

## 4. What Must Be Read For Each Frontend Area

For each area, the frontend pass should read at minimum:

- the relevant design documents under `design/`
- the relevant backend controller files
- the relevant backend service files
- the relevant DTO or schema definitions
- the relevant Prisma models when persisted state matters
- the relevant backend tests when they capture accepted behavior or edge cases

## 5. Frontend Execution Phases

The recommended frontend execution order is:

1. frontend baseline freeze
2. application skeleton and infrastructure
3. entry and access gating surfaces
4. trusted-device and recovery flows
5. workspace shell and primary app frame
6. timeline and lightweight composer
7. advanced upload and creation flows
8. history, search, and item detail
9. outward sharing, extraction, and public links
10. live transfer
11. user settings and trusted-access management
12. admin site
13. integration polish and end-to-end stabilization

## 6. Phase 0: Frontend Baseline Freeze

### Goal

- confirm that frontend execution starts from the accepted planning corpus rather than from ad hoc visual decisions

### Includes

- shell boundaries
- route and bootstrap strategy
- workspace information architecture
- surface and interaction baseline
- theme rule
- timeline composer placement and control shape

### Primary Inputs

- `design/37`
- `design/38`
- `design/39`
- `design/40`

### Completion Condition

- the frontend baseline is stable enough that later implementation does not need to reopen shell, route, or default-surface questions

## 7. Phase 1: Application Skeleton And Infrastructure

### Goal

- establish the user-site and admin-site foundations without yet trying to complete product pages

### Includes

- user-site application skeleton
- admin-site application skeleton
- shell containers
- routing skeleton
- theme support for light and dark mode
- API client foundation
- protected-route and shell-guard foundation
- shared low-level design primitives

### Must Read Before Building

- `design/23`
- `design/34`
- `design/37`
- `design/38`
- `design/40`
- backend session/bootstrap/admin code

### Completion Condition

- the two frontend sites can host their own shells and route families with correct high-level session behavior

## 8. Phase 2: Entry And Access Gating Surfaces

### Goal

- complete the identity-entry and gate-state experience before ordinary product work begins

### Includes

- login
- register
- waiting for approval
- blocked account
- session-expired handling where needed
- bootstrap-driven redirect behavior

### Must Read Before Building

- `design/01`
- `design/02`
- `design/23`
- `design/34`
- `design/35`
- identity/session/bootstrap backend code

### Completion Condition

- account entry and gate-state routing are correct and do not confuse session with trusted access

## 9. Phase 3: Trusted-Device And Recovery Flows

### Goal

- complete all trust-establishment and trust-recovery experiences before ordinary product access is treated as frontend-ready

### Includes

- first device setup
- first recovery-code interruption
- pair new device
- pair waiting
- pair approval
- recovery flow
- rotated recovery-code interruption

### Must Read Before Building

- `design/18`
- `design/23`
- `design/31`
- `design/34`
- `design/35`
- trust, recovery, and related backend modules

### Completion Condition

- device trust, recovery, interruption durability, and trust-state transitions are correct from the frontend perspective

## 10. Phase 4: Workspace Shell And Primary App Frame

### Goal

- establish the long-lived user workspace frame before filling in full domain breadth

### Includes

- workspace shell
- primary navigation
- top bar
- global search entry
- user menu
- theme toggle
- workspace route hosting

### Must Read Before Building

- `design/02`
- `design/15`
- `design/21`
- `design/28`
- `design/39`
- `design/40`
- projection-backed backend routes and bootstrap behavior

### Completion Condition

- `/app` can host the ordinary trusted product frame cleanly and consistently

## 11. Phase 5: Timeline And Lightweight Composer

### Goal

- complete the primary user surface and the default send-to-self experience

### Includes

- active timeline stream
- bottom-docked lightweight composer
- confidentiality round button
- text input region
- round attachment button
- text item presentation
- file card presentation
- grouped item presentation
- validity-dot rendering
- active invalidation messaging

### Must Read Before Building

- `design/02`
- `design/05`
- `design/07`
- `design/20`
- `design/21`
- `design/25`
- `design/28`
- `design/39`
- `design/40`
- uploads, source-items, projections, retrieval backend code

### Completion Condition

- the timeline matches accepted product direction and respects all visible-metadata, validity, and retrieval constraints

## 12. Phase 6: Advanced Upload And Creation Flows

### Goal

- complete the non-lightweight stored-transfer creation paths

### Includes

- advanced upload page
- file upload flow
- grouped-content upload flow
- folder upload flow
- upload session progress and failure handling
- advanced confidentiality selection
- validity selection and other allowed send-time options

### Must Read Before Building

- `design/02`
- `design/05`
- `design/07`
- `design/24`
- `design/25`
- `design/34`
- `design/35`
- upload and source lifecycle backend code

### Completion Condition

- lightweight and advanced creation paths are both accurate, deliberate, and policy-compatible

## 13. Phase 7: History, Search, And Item Detail

### Goal

- complete the review and lookup surfaces that sit beside the active timeline

### Includes

- history page
- search page
- item detail views
- retrievability and retained-reason display
- consumed, expired, revoked, and invalidated distinction

### Must Read Before Building

- `design/20`
- `design/21`
- `design/22`
- `design/27`
- `design/28`
- `design/39`
- projection and retrieval backend code

### Completion Condition

- users can review, search, and inspect objects without violating the metadata and read-model boundaries

## 14. Phase 8: Outward Sharing, Extraction, And Public Links

### Goal

- complete sender and recipient delivery experiences beyond self-space

### Includes

- user-targeted share creation from items
- incoming share detail
- repeat-download and no-repeat behavior surfaces
- extraction creation
- extraction retrieval page
- public-link creation
- public-link recipient landing and unavailable states

### Must Read Before Building

- `design/05`
- `design/20`
- `design/21`
- `design/27`
- `design/30`
- `design/34`
- `design/35`
- sharing, extraction, public-link, and retrieval backend code

### Completion Condition

- outward delivery surfaces are correct, mode-separated, and do not leak disallowed metadata

## 15. Phase 9: Live Transfer

### Goal

- complete the distinct live-transfer user experience without collapsing it into stored transfer

### Includes

- live start
- join
- confirm
- connecting and transport states
- active transfer
- failure
- explicit switch to normal transfer

### Must Read Before Building

- `design/02`
- `design/05`
- `design/26`
- `design/34`
- `design/35`
- live-transfer backend code and retained-record projection behavior

### Completion Condition

- live transfer behaves as an explicit, separate subsystem with correct status transitions and fallback messaging

## 16. Phase 10: User Settings And Trusted-Access Management

### Goal

- complete user-side management surfaces that belong inside ordinary product use but are not part of the main transfer stream

### Includes

- theme toggle surface if not already complete
- current-browser trust actions
- trusted-access removal from this browser
- profile basics where needed
- admin-console handoff entry for admin-capable users

### Must Read Before Building

- `design/18`
- `design/23`
- `design/31`
- `design/34`
- `design/39`
- `design/40`
- trust and maintenance backend code

### Completion Condition

- settings remains user-scoped and does not drift into admin control-plane behavior

## 17. Phase 11: Admin Site

### Goal

- complete the separate admin frontend site and its control-plane workflows

### Includes

- admin-site entry handling
- overview
- invites
- pending approvals
- users
- policy management
- policy history
- operations summary

### Must Read Before Building

- `design/02`
- `design/24`
- `design/29`
- `design/34`
- `design/35`
- admin and policy backend code

### Completion Condition

- the admin site is operationally useful, clearly separate from the user site, and never drifts into content-reading behavior

## 18. Phase 12: Integration Polish And End-To-End Stabilization

### Goal

- unify the frontend into one stable product after all primary domains exist

### Includes

- theme consistency across all shells
- loading, empty, and error-state consistency
- responsive cleanup
- accessibility pass
- route-transition cleanup
- final contract verification against backend behavior

### Completion Condition

- the frontend behaves consistently across shells, delivery modes, and device states

## 19. Required Deliverables For Every Frontend Phase

Each frontend phase should produce at minimum:

1. the exact design documents reviewed
2. the exact backend files reviewed
3. the extracted state, route, and visible-metadata rules
4. the frontend design conclusion for that phase
5. the implementation itself
6. verification results
7. any remaining risk or deferred item

## 20. Verification Rule

Frontend verification should check at minimum:

- route and shell correctness
- trust-state correctness
- metadata-boundary correctness
- policy- and retrieval-state correctness
- light and dark theme consistency
- mobile and desktop rendering for the affected area

## 21. Start Condition

Frontend implementation should begin only when the user gives a direct command to start.

Until then, this document is planning guidance only.
