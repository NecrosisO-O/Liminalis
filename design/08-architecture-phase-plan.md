# Liminalis Architecture Phase Plan

## Status

- Planned architecture-phase work

## Goal

Turn the settled product design into a stable architectural baseline for `Liminalis` without prematurely starting implementation.

The architecture phase should convert product decisions into:

- system boundaries
- data and object models
- security and key-handling structure
- deployment and service topology
- implementation-ready architecture assumptions

## Working Principles

- Stay inside the confirmed `v1` scope
- Treat deferred items as explicit assumptions instead of silently expanding scope
- Prefer clear boundaries over premature optimization
- Keep the architecture understandable from the product model
- Avoid implementation detail unless it is necessary to settle an architectural constraint

## Architecture Work Packages

### 1. v1 Architecture Boundary

Define what the architecture must support in the first version and what remains explicitly deferred.

Focus:

- web-only scope
- send-to-self default anchor
- item-first sharing only
- deferred share-first path
- later extensions such as Telegram bot and native clients as explicit future assumptions

Expected output:

- `v1` architecture assumptions document

### 2. System Module Boundaries

Partition the system into stable architectural modules and define their responsibilities.

Focus:

- auth and user admission
- trusted devices and recovery
- self-space transfer handling
- outward sharing management
- public-link and password-extraction handling
- live-transfer session management
- confidentiality-policy evaluation
- storage, cleanup, and retention
- admin panel and instance strategy control
- history and lookup surfaces

Expected output:

- system module map with responsibilities and dependencies

### 3. Core Domain Model

Define the main objects, their relationships, and their lifecycle boundaries.

Focus:

- user
- trusted browser device
- source item
- share object
- password-extraction object
- public-link object
- live-transfer session
- recovery credential
- confidentiality-policy bundle
- history record

Expected output:

- core object and relationship model

### 4. Flow And State Model

Define the major product flows as explicit architectural state transitions.

Focus:

- self upload and retrieval flow
- source item to outward share flow
- password-extraction flow
- public-link flow
- trusted-device onboarding and recovery flow
- burn-after-read removal flow
- live-transfer session flow
- invalidation and retention transitions

Expected output:

- flow and state-transition reference

### 5. Security And Key Architecture

Turn the settled trust and confidentiality design into a clear architectural security model.

Focus:

- account identity versus trusted device access
- server-held metadata versus client-held decryption ability
- key-wrapping or capability distribution for trusted devices
- protected transfer flows versus public-link exception
- confidentiality policy as access and transport strategy rather than algorithm switching
- large-file encrypted transfer constraints such as chunking and streaming assumptions

Expected output:

- security and key-architecture document

### 6. Storage And Service Topology

Define the service roles and data-placement model for the self-hosted system.

Focus:

- frontend application role
- backend API role
- realtime or session service role
- object or blob storage role
- database and metadata role
- cleanup and expiry task role
- relay-related service role for live transfer

Expected output:

- service topology and deployment-shape document

### 7. Architecture Baseline For Implementation

Assemble the architecture outputs into a coherent baseline that can guide implementation later.

Focus:

- major components and interfaces
- object boundaries
- core service responsibilities
- key architectural constraints
- deferred assumptions carried forward from design
- suggested implementation order

Expected output:

- architecture baseline summary

## Suggested Execution Order

1. v1 architecture boundary
2. system module boundaries
3. core domain model
4. flow and state model
5. security and key architecture
6. storage and service topology
7. architecture baseline for implementation

## Deferred Inputs To Carry Forward

- how the share-first path should interact with confidentiality policy
- any future expansion for bot-driven ingestion or native clients

## Completion Condition

The architecture phase is complete when `Liminalis` has a documented architectural baseline that is specific enough to guide implementation, while still respecting the confirmed `v1` scope and deferred items.
