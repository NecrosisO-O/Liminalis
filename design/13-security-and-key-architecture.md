# Liminalis Security And Key Architecture

## Status

- Accepted draft for the security and key-architecture direction

## Purpose

This document defines the high-level security and key-handling model for `Liminalis` v1.

It focuses on architectural rules rather than low-level implementation detail.

## Core Principles

- protected transfer flows should remain distinct from explicit convenience exceptions
- trusted-device access should be modeled separately from account identity
- confidentiality policy should primarily affect access, sharing, and transport behavior rather than switching the core content-encryption algorithm
- large-file protection must be compatible with chunked and streaming processing

## 1. Protected Flows Versus Exception Flows

Protected flows:

- self stored transfer
- user-targeted sharing
- password extraction
- live transfer

Explicit convenience exception:

- public-link delivery

Architectural consequence:

- the public-link model must remain architecturally distinct from the protected flow assumptions

## 2. Access Model

`Liminalis` uses a mixed access model:

- account identity determines who the user is
- trusted-device state determines which browser instances may access protected content
- policy-controlled visibility determines whether newly added devices may view older content
- object-level access outcomes should be materialized through explicit access-grant structures rather than left implicit in unrelated objects

Architectural consequence:

- access to older protected content must not be modeled as purely account-wide or purely device-local
- it must remain policy-aware
- source items and share objects should each carry their own current access-grant result
- successful recovery should trigger re-evaluation or re-grant of historical object access under the same trusted-access domain rules
- identity-bound protected sharing should rely on recipient-published public wrapping material rather than on server access to recipient plaintext trust roots
- ordinary pairing should not silently widen historical object visibility when the object's access mode is snapshot-limited

## 3. Recovery Position

- recovery should restore access for the account across historical confidentiality levels equally
- recovery should not create a separate stronger or weaker post-recovery class for higher confidentiality levels

Architectural consequence:

- recovery must be modeled as a restoration path into the same trusted-access domain, not as an inferior access tier

## 4. Source Content Versus Share Access

- source content should be treated as the primary protected content body
- share objects should primarily add access-control and lifecycle layers rather than force full content re-encryption by default

Architectural consequence:

- content bodies should be reusable where possible, without violating confidentiality-policy restrictions or stricter delivery-path assumptions
- access grants, policy snapshots, and delivery constraints should vary per share object
- one share object may act as the outward-delivery root for sibling recipient, password-extraction, and public-link delivery paths

## 5. Password Extraction Versus Public Links

- password extraction remains part of the protected-delivery family
- public-link delivery remains the explicit convenience exception

Architectural consequence:

- `ExtractionAccess` and `PublicLink` must remain distinct objects and access models
- they should not be collapsed into one generic anonymous-share system
- public-link delivery should remain controlled through short-lived delivery access rather than unmanaged long-lived object URLs

## 6. Confidentiality Policy Scope

- confidentiality policy should control access permissions, transport permissions, defaults, and upper bounds
- confidentiality policy should not switch the core content-encryption algorithm per level in `v1`

Architectural consequence:

- the content-encryption approach should remain unified across confidentiality levels in `v1`
- confidentiality differences should be enforced through policy interpretation rather than algorithm-family switching

## 7. Live Transfer Security Boundary

- live transfer remains a separate subsystem
- it should reuse identity, trusted-device, and confidentiality-policy decisions
- it should not inherit stored-transfer lifecycle rules such as ordinary retention or share-object validity semantics

Architectural consequence:

- live transfer security decisions should be policy-driven but session-local

## 8. Large-File Constraints

The architecture should assume:

- no whole-file-in-memory requirement
- chunked or streaming encryption and decryption
- chunked or streaming upload and download
- progress and failure handling that can span prepare, encrypt, upload, download, and decrypt phases
- content-body reuse when outward sharing repeats from one source item

Architectural consequence:

- large-file handling is a structural requirement, not a later optimization task
