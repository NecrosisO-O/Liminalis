# Liminalis Confidentiality Policy Engine And PolicyBundle Note

## Status

- Detailed implementation-planning note

## Purpose

This document defines the implementation-planning baseline for the `Liminalis` `v1` confidentiality-policy engine and the `PolicyBundle` model it evaluates.

Its goal is to turn the already accepted confidentiality design into a concrete evaluation model that other modules can depend on before coding begins.

This note does not restate all policy content values. Instead, it defines:

- how policy is structured
- which inputs policy evaluation consumes
- which outputs it returns
- when snapshot values are persisted
- when current policy is consulted at action time
- how admin-edited policy interacts with already created objects

## 1. Planning Goals

- keep confidentiality policy as a distinct backend policy layer
- make `PolicyBundle` a stable implementation object rather than a loose settings bag
- define evaluation contracts for uploads, shares, retrieval-adjacent actions, public links, live transfer, and admin edits
- preserve the accepted distinction between snapshot-based object behavior and action-time policy checks
- prevent silent retroactive rewriting of existing objects when admin policy changes
- keep fixed system rules separate from editable per-level strategy fields

## 2. Core Policy Principle

The accepted `v1` policy principle is:

- `state-preserving, action-blocking`

Meaning:

- existing `SourceItem` and `ShareObject` objects keep their persisted snapshot-driven lifecycle and access semantics
- new actions are evaluated against current policy at action time
- if current policy now disallows a new action, that action is blocked even if similar historical objects already exist

Examples:

- an already created share does not automatically expire or revoke just because the admin later tightens the level policy
- creating a new share of that type later may be blocked by current policy
- a source item keeps its old validity choice and access shape snapshot, but a future live-transfer attempt from that item still depends on current policy

## 3. Policy Engine Boundary

### 3.1 Responsibilities

The confidentiality-policy engine is responsible for:

- loading the current `PolicyBundle` for one confidentiality level
- validating whether requested actions are allowed
- resolving defaults and upper bounds at action time
- producing snapshot-ready resolved policy results for new `SourceItem` and `ShareObject` objects
- answering admin-surface validation questions when policy is edited

### 3.2 Non-Responsibilities

The policy engine must not:

- own source-item lifecycle state directly
- own share-object lifecycle state directly
- own `AccessGrantSet` persistence directly
- become a generic permissions engine for unrelated application features
- directly mutate historical objects merely because policy changed

## 4. Fixed System Rules Versus Editable Policy Fields

`v1` must distinguish between:

- fixed system rules
- editable per-level policy fields

### 4.1 Fixed System Rules

These are architectural/product rules, not ordinary per-level toggles:

- there are exactly three confidentiality levels
- their names are fixed: `secret`, `confidential`, `top secret`
- text remains self-space only in `v1`
- public links remain the explicit convenience exception path
- account identity remains distinct from trusted-device decryption access
- burn-after-read uses purge semantics rather than retained inactive history

### 4.2 Editable Per-Level Fields

These are strategy values that the admin may configure per level within the accepted product boundary:

- lifecycle defaults and upper bounds
- whether newly added trusted devices may view older content
- whether outward sharing is allowed
- which outward sharing methods are allowed
- user-targeted share defaults and limits
- password-extraction defaults and limits
- public-link defaults and limits
- live-transfer permissions and fallback permissions

## 5. PolicyBundle Model

Each confidentiality level resolves to one current `PolicyBundle`.

### 5.1 PolicyBundle Identity Fields

At minimum, a `PolicyBundle` should carry:

- `level_name`: `secret`, `confidential`, or `top_secret`
- `bundle_version`
- `is_current`
- `updated_at`
- `updated_by_admin_id` when applicable

### 5.2 PolicyBundle Sections

Each bundle should expose these logical sections:

- lifecycle
- share availability
- user-targeted sharing
- password extraction
- public links
- live transfer

This matches the accepted admin configuration shape from `design/05-confidentiality-impact-map.md`.

## 6. Editable Policy Fields By Section

### 6.1 Lifecycle Section

The lifecycle section should contain:

- `default_validity`
- `maximum_validity`
- `allow_never_expire`
- `allow_validity_extension_later`
- `allow_newly_added_trusted_devices_to_view_older_content`
- `allow_outward_resharing`

### 6.2 Share Availability Section

The share-availability section should contain:

- `allow_outward_sharing`
- `restrict_to_self_only`
- `allow_recipient_resharing`
- `allow_multiple_outward_shares`
- `allow_user_targeted_sharing`
- `allow_password_extraction`
- `allow_public_links`

### 6.3 User-Targeted Sharing Section

The user-targeted-sharing section should contain:

- `default_share_validity`
- `maximum_share_validity`
- `allow_repeat_download`
- `allow_recipient_multi_device_access`

### 6.4 Password Extraction Section

The password-extraction section should contain:

- `allow_password_extraction`
- `require_system_generated_password`
- `maximum_retrieval_count`

### 6.5 Public Links Section

The public-links section should contain:

- `allow_public_links`
- `maximum_public_link_validity`
- `maximum_public_link_download_count`

### 6.6 Live Transfer Section

The live-transfer section should contain:

- `allow_live_transfer`
- `allow_peer_to_peer`
- `allow_relay`
- `allow_peer_to_peer_to_relay_fallback`
- `allow_live_to_stored_fallback`
- `retain_live_transfer_records`
- `allow_grouped_or_large_live_transfer`

## 7. Policy Inputs

The engine should evaluate policy using typed action-specific inputs, not free-form feature checks.

### 7.1 Common Evaluation Inputs

At minimum, common inputs include:

- confidentiality level
- actor role and identity context
- object type: `source_item`, `share_object`, or `live_transfer_request`
- source-item state when relevant
- requested action type
- requested validity or count values when relevant
- selected delivery mode when relevant

### 7.2 Source-Action Inputs

For source-item creation or mutation, inputs may include:

- requested validity
- requested burn-after-read attachment
- whether the source is text or file-oriented content

### 7.3 Share-Action Inputs

For share creation, inputs may include:

- selected outward-sharing mode
- requested share validity
- recipient access expectations
- whether multiple outward shares already exist from the same source item

### 7.4 Live-Transfer Inputs

For live transfer, inputs may include:

- requested transfer shape
- grouped or large-file flag
- desired transport preferences
- fallback request intent

## 8. Policy Outputs

The engine should return structured outputs, not only boolean allow or deny responses.

### 8.1 Common Output Shape

Each evaluation should be able to return:

- `allowed`
- `decision_reason`
- `resolved_defaults`
- `resolved_maximums`
- `resolved_mode`
- `snapshot_fields_to_persist` where applicable

### 8.2 Why Structured Output Is Needed

- many product actions need more than yes or no
- the caller often needs resolved defaults, upper bounds, and access-shaping choices
- snapshot creation must persist resolved policy results without recomputing them later from guessed UI state

## 9. Main Evaluation Families

The engine should expose distinct evaluation families.

### 9.1 Source Creation Evaluation

Used when creating a new `SourceItem`.

Should answer:

- what default validity applies
- what maximum validity applies
- whether the requested validity is allowed
- whether never-expire is allowed
- whether later validity extension is allowed
- whether newly added trusted devices may view older content
- whether outward resharing is allowed from this source level
- which snapshot fields must be persisted on the new source item

### 9.2 Source-Level Change Evaluation

Used when changing a source item's confidentiality level later.

Should answer:

- whether the level change is allowed now
- what future action constraints follow from the new level
- which future-facing snapshot values should be used for newly derived shares

Planning rule:

- this evaluation must not silently rewrite already created share objects

### 9.3 Share-Creation Evaluation

Used when creating a new `ShareObject` from a source item.

Should answer:

- whether outward sharing is allowed at all
- whether the selected outward mode is allowed
- whether the source is currently self-only
- whether additional outward shares are allowed from this source item
- what default and maximum share validity apply
- whether the requested share validity is allowed
- whether repeat download is allowed
- whether recipient multi-device access is allowed
- which snapshot fields must be persisted on the new share object

### 9.4 Password-Extraction Evaluation

Used when creating `ExtractionAccess`.

Should answer:

- whether password extraction is allowed
- whether the password must be system generated
- what maximum retrieval count applies
- whether the requested retrieval count is allowed

### 9.5 Public-Link Evaluation

Used when creating `PublicLink`.

Should answer:

- whether public links are allowed
- what maximum validity applies
- what maximum download count applies
- whether the requested validity and count are allowed

### 9.6 Live-Transfer Evaluation

Used when creating or falling back within `LiveTransferSession`.

Should answer:

- whether live transfer is allowed
- whether peer-to-peer is allowed
- whether relay is allowed
- whether peer-to-peer may fall back to relay
- whether live transfer may fall back to stored transfer
- whether live-transfer records should be retained
- whether grouped or large live transfer is allowed

### 9.7 Action-Time Validation Evaluation

Used for future actions on already existing objects.

Examples:

- may a new share be created now from this source item
- may a live-transfer session be created now
- may a validity extension be requested now

Planning rule:

- this evaluation uses current `PolicyBundle`, not historical bundle snapshots, unless the action is explicitly defined as snapshot-preserved behavior

## 10. Snapshot Persistence Rules

### 10.1 SourceItem Snapshot Rule

When a `SourceItem` is created, the engine should produce the source-level snapshot fields needed to preserve stable lifecycle and access semantics.

At minimum, that snapshot should include:

- effective confidentiality level
- effective chosen validity
- whether later validity extension is allowed
- whether newly added trusted devices may view older content
- whether outward resharing is allowed

### 10.2 ShareObject Snapshot Rule

When a `ShareObject` is created, the engine should produce the share-level snapshot fields needed to preserve stable delivery semantics.

At minimum, that snapshot should include:

- effective confidentiality level at share creation time
- effective chosen share validity
- effective repeat-download rule
- effective recipient multi-device rule
- effective outward mode
- any access-limiting rule that affects `AccessGrantSet` interpretation

### 10.3 Why Snapshot Persistence Exists

- historical object behavior must remain understandable after later admin policy edits
- write-side objects must not depend on reconstructing historical policy from a mutable current admin screen

## 11. Action-Time Policy Rule

The following future actions should use current policy at action time:

- creating a new share
- creating `ExtractionAccess`
- creating `PublicLink`
- starting live transfer
- requesting live-to-stored fallback
- requesting validity extension

Planning consequence:

- current policy can block future actions without retroactively rewriting existing objects

## 12. Admin Policy Editing Rules

### 12.1 Editable Surface Rule

- admins may edit per-level strategy fields within the accepted product boundary
- fixed system rules must not be exposed as ordinary editable toggles

### 12.2 Validation Rule

Admin edits must be validated before a new `PolicyBundle` becomes current.

Validation should reject invalid combinations such as:

- allowing peer-to-peer-to-relay fallback when relay itself is disabled
- setting a default value above its maximum
- allowing public-link defaults when public links are disabled
- setting share defaults for a delivery mode that is disabled for that level

### 12.3 Publication Rule

- a valid admin edit should create a new current `PolicyBundle` version for that level rather than mutating historical meaning in place
- older bundle versions may remain internally visible for audit and reasoning, but do not remain the current evaluation source

`v1` publication rule:

- policy edits should publish immediately once validation succeeds
- `v1` does not need a separate draft-versus-published workflow for confidentiality bundles

## 13. Policy Precedence Rules

The effective precedence should be:

1. fixed system rules
2. current level `PolicyBundle`
3. requested action parameters constrained by that bundle
4. persisted object snapshots for already created objects where snapshot semantics apply

This means:

- a user request cannot exceed policy maximums
- a persisted object's old snapshot can preserve its own historical semantics
- that snapshot does not override current policy for future unrelated actions

## 14. Interaction With Other Modules

### 14.1 Source Item Lifecycle

- consumes source-creation and source-change policy outputs
- persists source snapshots

### 14.2 Sharing And Delivery

- consumes share-creation, password-extraction, and public-link policy outputs
- persists share snapshots

### 14.3 Trusted Device And Recovery

- consumes the policy outcome about whether newly added trusted devices may view older content
- must not own that rule independently

### 14.4 AccessGrantSet

- consumes policy outputs that shape `owner_domain` versus `owner_device_snapshot`
- consumes policy outputs that shape `recipient_domain` versus `recipient_device_snapshot`

### 14.5 Live Transfer Session

- consumes live-transfer transport and fallback policy outputs

### 14.6 Instance Administration

- owns editing and publishing current `PolicyBundle` values
- does not directly own the evaluation logic itself

## 15. Built-In Default Bundles

`v1` should ship with built-in default bundles corresponding to the accepted preset document in `design/07-confidentiality-default-presets.md`.

Planning rule:

- those presets are the initial current `PolicyBundle` values, not a separate parallel policy system

## 16. Security Red Lines

Implementation planning should not allow these shortcuts:

- do not scatter policy decisions across unrelated handlers without the policy engine boundary
- do not treat current admin policy as a reason to silently rewrite existing object snapshots
- do not store only UI-form values when a resolved snapshot output is required
- do not let per-level configuration violate fixed system rules
- do not let frontend policy mirrors become the source of truth
- do not let policy evaluation collapse into raw boolean feature flags without structured outputs

## 17. Follow-Up Planning Needed

The next planning work should still define:

- the exact backend evaluation API surface for each evaluation family
- the exact persisted schema for `PolicyBundle` versions and object snapshots
- the upload/storage note that consumes source-creation policy outputs
- the live-transfer note that consumes live-transfer policy outputs
- the admin control-plane note that defines policy editing workflows and validation UX
