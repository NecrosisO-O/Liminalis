# Liminalis v1 Architecture Boundary

## Status

- Accepted architecture-boundary draft

## Purpose

This document defines the true architectural boundary for `Liminalis` v1 after design completion.

It does not restate settled product design as if it were undecided. Instead, it identifies which already-set product capabilities must be treated as hard architectural constraints and how deferred items should be carried forward.

## v1 Hard Architectural Constraints

The following are not optional or deferrable in `v1` architecture:

- large files and grouped file objects must be supported architecturally
- the trusted-device and recovery model must be first-class in the architecture
- active timeline, detailed history, and trusted-device search must be first-class in the architecture
- confidentiality policy evaluation must be a core architectural concern
- live transfer must exist in `v1`, but not as the primary architectural center of the product

## Accepted Architecture Boundary Decisions

### 1. Live Transfer Position

- stored transfer remains the primary architectural center of the product
- live transfer is treated as a distinct subsystem rather than merged into the same core transfer engine

### 2. Confidentiality Policy Position

- confidentiality policy should be implemented as a distinct policy layer rather than scattered across unrelated modules
- upload, sharing, retrieval, public-link, password-extraction, and live-transfer permission decisions should be interpreted through this policy layer

### 3. Source Item And Share Object Boundary

- source items and share objects should be modeled as distinct domain objects
- share objects may reference source items, but should retain their own lifecycle and policy state

### 4. Timeline And History Data Boundary

- the active timeline and detailed history should come from a shared underlying object/event source
- they differ by query and presentation rules rather than by separate parallel data systems

### 5. Live-To-Stored Fallback Boundary

- live transfer and stored transfer should remain separate subsystems
- fallback from live transfer to normal stored transfer should happen through explicit handoff interfaces rather than a single unified transfer-state machine

### 6. Deferred Feature Handling

- deferred items should be carried as explicit architecture assumptions rather than full built modules
- the main deferred item is the share-first path and its confidentiality interaction
- later bot ingestion and native-client expansion should be acknowledged as future extension directions, but should not distort `v1` architecture unnecessarily

## Explicit Deferred Assumptions

- `v1` does not include share-first as a product flow
- architecture should not block future share-first support, but should not build full share-first-specific subsystems now
- `v1` does not include native-client-specific architecture as a first-class delivery target
- `v1` does not include bot-ingestion-specific architecture as a first-class delivery target
- `v1` text source items remain in self-space only and do not enter outward-share or live-transfer flows

## Consequence For Architecture Phase

The next architecture work should now proceed under these assumptions:

- product boundaries are already settled
- the remaining work is to derive stable modules, domain objects, state transitions, security structure, and deployment shape from the settled design
- architectural overreach for deferred features should be avoided
