# Liminalis Storage And Service Topology

## Status

- Accepted storage-and-service-topology draft

## Purpose

This document defines the high-level runtime roles, storage placement, and deployment shape for `Liminalis` v1.

It focuses on logical service roles and storage responsibilities, not on final vendor or infrastructure selection.

## Core Topology Principle

`Liminalis` v1 should prefer clear logical boundaries over heavy multi-service deployment.

The architecture should therefore:

- keep runtime roles explicit
- keep metadata and ciphertext storage clearly separated
- avoid unnecessary microservice decomposition in `v1`

## Runtime Roles

### 1. Browser Frontend

Responsibilities:

- main product UI
- admin panel UI
- active timeline, history, upload, and state pages
- local encryption and decryption execution where required
- local trusted-device runtime behavior

### 2. Main Backend Application

Responsibilities:

- identity and admission
- trusted-device and recovery coordination
- source-item lifecycle handling
- outward sharing metadata and lifecycle handling
- confidentiality-policy evaluation
- admin configuration handling
- history and lookup queries
- state transition and cascade execution

### 3. Metadata Database

Stores:

- users
- trusted devices
- recovery credential versions
- source-item metadata
- source-item access-grant and visibility state
- share-object metadata
- share-object access-grant and visibility state
- password-extraction state
- public-link state
- live-transfer session state
- history and lookup support records, including title and visible-metadata search support
- confidentiality policy bundles
- admin configuration, invites, approvals, limits, and system-state metadata

### 4. Object Storage / Blob Storage

Stores:

- encrypted file bodies
- encrypted grouped-file bodies
- chunked file data
- temporary upload chunks or intermediate ciphertext objects
- reusable ciphertext bodies referenced by multiple share objects when applicable

### 5. Realtime / Relay Role

Responsibilities:

- live-transfer session coordination
- realtime status updates for live transfer
- relay transport handling when policy permits it
- timeout and session-side connection support

### 6. Background Jobs

Responsibilities:

- source-item expiry handling
- share-object invalidation cascades
- password-extraction and public-link expiry handling
- burn-after-read purge work
- temporary-object cleanup
- expired session cleanup
- history and search consistency maintenance where needed

`v1` minimum background job set should prioritize:

- source-item and share-object expiry or invalidation
- burn-after-read purge work
- expired live-transfer session cleanup

Other cleanup and consistency jobs may remain secondary refinements as long as the minimum lifecycle guarantees are preserved.

### Read-Model Projection Responsibility

- history and lookup should be maintained through an explicit internal projection or synchronization mechanism from write-side state changes
- read models should not be left to accidental front-end assembly or scattered ad hoc updates from multiple modules
- for `v1`, the search projection should stay intentionally narrow and limited to titles and visible metadata
- text items may contribute a short visible summary field to the search projection without introducing protected-content full-text indexing

## Storage Placement Rules

### Metadata Database

Use the database for:

- identities
- relationships
- policies
- lifecycle state
- query support
- administrative and control data
- encrypted text bodies for self-space text messages in `v1`
- search-support records for item titles and visible metadata in `v1`

### Object Storage

Use object storage for:

- ciphertext payloads
- grouped-content ciphertext bodies
- upload chunks and large-file bodies

### Not Intended For Long-Term Server Persistence

- frontend-local decrypted results
- ephemeral UI coordination state
- transient live-transfer negotiation state that does not need retention

## Live Transfer Placement

- live-transfer session metadata belongs with the main backend and metadata database
- realtime coordination belongs with the realtime or relay role
- relay traffic, when used, belongs with the realtime or relay role
- fallback into normal stored transfer re-enters the main backend and stored-transfer domain

## Deployment Guidance For v1

- these roles do not imply separate physical services from day one
- `v1` may keep the main backend, realtime role, and background jobs inside one primary deployment unit if boundaries remain clear
- the metadata database and object storage should remain logically separate even if self-hosted on the same machine

## Explicit Anti-Goals For v1 Topology

- no mandatory microservice split
- no mandatory dedicated search cluster
- no mandatory message-bus-heavy architecture
- no mandatory event-sourcing platform
- no premature multi-region or multi-tenant deployment complexity

## Practical v1 Shape

The recommended `v1` runtime shape is:

- Browser Frontend
- Main Backend Application
- Metadata Database
- Object Storage
- Realtime / Relay Role
- Background Jobs

These may be co-deployed on a single self-hosted server environment as long as their logical responsibilities remain distinct.
