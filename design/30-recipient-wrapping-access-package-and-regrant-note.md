# Liminalis Recipient Wrapping, Access Package, And Regrant Note

## Status

- Detailed implementation-planning note

## Purpose

This document refines the remaining implementation-planning gap around recipient-issued wrapping material, access-package metadata, package-family storage, and explicit regrant behavior in `Liminalis` `v1`.

Its goal is to close the last major ambiguity in the protected-sharing path before later API planning.

This note builds on:

- `design/17-key-and-access-architecture-note.md`
- `design/19-access-grant-set-structure-and-update-rules.md`
- `design/27-retrieval-protocol-and-package-issuance-note.md`

## 1. Planning Goals

- make recipient public wrapping material concrete enough for sharing and retrieval planning
- define access-package family metadata more explicitly
- define when package reissue and explicit regrant should occur
- preserve the rule that the server never needs recipient plaintext trust roots

## 2. Recipient Wrapping Objects

### 2.1 UserDomainAccessPublicKey

- the publishable public wrapping identity for one user's trusted-device domain
- safe for server storage and share issuance lookup

At minimum it should carry:

- owning user id
- public wrapping payload
- version marker
- current or superseded status
- published_at timestamp

### 2.2 DevicePublicIdentity

- the publishable public identity for one trusted device when device-snapshot wrapping is required

At minimum it should carry:

- owning device id
- owning user id
- public device payload
- current validity status

## 3. Publication Rule

- first trusted-device establishment should publish the first `UserDomainAccessPublicKey`
- trusted devices used for device-snapshot issuance should publish their `DevicePublicIdentity`
- the server stores published public material only; it must not require the corresponding private root or device private key

## 4. Rotation Rule

- future user-domain public wrapping rotation may create a new current `UserDomainAccessPublicKey` version
- historical package families remain understandable through their recorded version markers
- rotation does not automatically rewrite all historical ordinary package families unless an explicit maintenance or regrant action requires it

## 5. Access-Package Family Metadata

Each ordinary or recovery package family should have metadata that records at minimum:

- package family id
- package family type
- protected object id
- package family version
- subject scope type
- subject reference ids
- wrapped package blob reference
- issuing trigger such as create, regrant, recovery maintenance, or explicit access-mode change
- issued_at timestamp
- superseded_at when replaced

## 6. Subject Scope Types

Package families should distinguish at minimum:

- owner domain scope
- owner device snapshot scope
- recipient domain scope
- recipient device snapshot scope
- recovery scope
- password-extraction scope
- public-link ticket scope

## 7. Share Issuance Rule

When creating a user-targeted protected share:

- recipient-domain issuance must use the current recipient `UserDomainAccessPublicKey`
- recipient-device-snapshot issuance must use the explicitly granted recipient `DevicePublicIdentity` set
- if the needed public material is absent, share creation must be blocked rather than weakly queued

## 8. Retrieval Resolution Rule

- retrieval resolution should use `AccessGrantSet` to select the current package family
- package-family metadata should then identify the wrapped package blob or package payload reference to issue
- the retrieval layer must not derive subject scope from the user's current device list alone

## 9. Explicit Regrant Baseline

`v1` should keep room for explicit regrant without requiring a rich end-user regrant UX immediately.

Planning baseline:

- explicit regrant is an administrative or future product action, not an automatic side effect
- when it occurs, it creates a new package family version and, when ordinary access semantics changed, a new `AccessGrantSet` version

## 10. Regrant Scenarios

Explicit regrant may be needed when:

- a snapshot-mode object should be reissued to the user's current trusted devices
- a snapshot-mode share should be reissued to the recipient's current trusted devices
- a user-domain or recovery public wrapping rotation requires active package-family maintenance

## 11. Regrant Rule

When explicit regrant happens:

1. resolve the intended new subject scope
2. create the new package family version
3. create a new current `AccessGrantSet` version if ordinary access semantics changed
4. supersede the prior package family metadata

## 12. Recovery Maintenance Rule

- recovery package-family maintenance may rotate independently from ordinary package families
- if the active recovery package family changes, the corresponding `AccessGrantSet` version should also be replaced according to the accepted update rules

## 13. Snapshot-Mode Device Invalidation Rule

- when a device-snapshot subject becomes invalid, the system should create a replacement package family aligned with the updated explicit device set
- this is not optional because snapshot scope is part of the business promise

## 14. Security Red Lines

Implementation planning should not allow these shortcuts:

- do not store recipient private trust roots on the server
- do not infer device-snapshot scope by looking only at the current trusted-device list
- do not silently auto-regrant snapshot objects when new devices are paired
- do not replace package-family meaning in place without versioning
- do not treat missing recipient public material as a reason to degrade into a weaker hidden share model

## 15. Follow-Up Planning Needed

The next planning work should still define:

- the exact package-blob storage shape and encryption envelope references
- the exact API planning for public-material lookup and share issuance
- the future product UX, if any, for explicit regrant actions
- the implementation sequencing note that places recipient wrapping and package metadata before higher-level share APIs
