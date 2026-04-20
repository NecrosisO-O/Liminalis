# Liminalis Live Transfer Session And Fallback Note

## Status

- Detailed implementation-planning note

## Purpose

This document defines the implementation-planning baseline for the `Liminalis` `v1` live-transfer subsystem, including session states, peer-to-peer and relay behavior, failure handling, retained-record policy, and explicit handoff into stored transfer.

Its goal is to make live transfer specific enough for later sequencing and interface planning while preserving the already accepted architectural rule that live transfer remains secondary to stored transfer rather than becoming the product's central lifecycle engine.

This note builds on:

- `design/09-v1-architecture-boundary.md`
- `design/12-flow-and-state-model.md`
- `design/24-confidentiality-policy-engine-and-bundle-note.md`

## 1. Planning Goals

- keep live transfer as a distinct subsystem rather than merging it into stored transfer
- reuse identity, trusted-device, and policy decisions without inheriting stored-transfer lifecycle rules blindly
- define the session-local transport model clearly enough for implementation planning
- define peer-to-peer, relay, and fallback behavior explicitly
- define retained-record behavior separately from transfer completion

## 2. Scope Boundary

This note covers:

- live-transfer session creation
- session transport attempts
- p2p and relay usage
- session completion, failure, expiry, and cancellation
- explicit handoff into stored transfer when policy allows

This note does not define:

- stored-transfer upload chunk protocol
- live-transfer API route shapes
- future native-client live-transfer behavior

## 3. Core Architectural Rule

`v1` live transfer remains a distinct subsystem.

Planning consequence:

- live transfer has its own session state machine
- live transfer does not directly become a `SourceItem` or `ShareObject`
- any fallback into stored transfer must happen through an explicit handoff into the stored-transfer domain

## 4. Eligible Content Rule

`v1` live transfer applies to:

- file-like content
- grouped or large file transfer when policy allows

`v1` live transfer does not apply to:

- self-space text items

## 5. Session Participants

### 5.1 Initiating Participant

- the user or trusted device that creates the live-transfer session

### 5.2 Joining Participant

- the other participant who joins and confirms the live-transfer session

### 5.3 Coordination Service

- the backend role that creates session records, tracks session state, applies policy gating, and coordinates fallback

### 5.4 Relay Role

- the realtime or relay role that handles relay transport only when allowed by policy
- relay should handle encrypted payload transport rather than decrypted content

## 6. Session State Baseline

`v1` live transfer should use the primary state family already accepted in the state model:

- `created`
- `awaiting_join`
- `awaiting_confirmation`
- `connecting`
- `active`
- `completed`
- `expired`
- `failed`
- `cancelled`

Transport substates should include:

- `p2p_attempt`
- `relay_attempt`
- `p2p_active`
- `relay_active`

## 7. Session Creation Gate

Before creating a live-transfer session, the backend should validate:

- the initiating identity is allowed to use live transfer under current policy
- the selected confidentiality level permits live transfer
- the requested transfer shape is allowed
- grouped or large transfer is allowed if applicable

Planning rule:

- live-transfer permission is always action-time policy evaluated

## 8. Session Flow Baseline

The baseline flow is:

1. initiator creates the live-transfer session
2. session enters `awaiting_join`
3. joiner enters and the session moves to `awaiting_confirmation`
4. both parties confirm the session
5. session enters `connecting`
6. transport attempts begin according to policy and session negotiation
7. session becomes `active` if one transport succeeds
8. session becomes `completed`, `failed`, `expired`, or `cancelled` depending on the outcome

## 9. Transport Policy Interpretation

### 9.1 Peer-To-Peer

- may be attempted only when current policy allows peer-to-peer transport

### 9.2 Relay

- may be attempted only when current policy allows relay transport

### 9.3 Peer-To-Peer To Relay Fallback

- may happen only when current policy allows relay and explicitly allows peer-to-peer-to-relay fallback

### 9.4 Live-To-Stored Fallback

- may happen only when current policy explicitly allows live-transfer failure to fall back to stored transfer

## 10. Preferred Transport Baseline

`v1` should use:

- peer-to-peer first when policy allows it
- relay fallback when peer-to-peer fails and policy allows peer-to-peer-to-relay fallback

Timeout baseline:

- the first peer-to-peer attempt should time out after about 10 seconds before relay fallback is considered

## 11. Relay Security Rule

- relay transport must not require decrypted-content handling by the relay role
- relay traffic should carry encrypted payloads or encrypted session data only
- relay allowance remains a policy decision, not a hidden always-on escape hatch

## 12. Live Transfer Completion Rule

- a session becomes `completed` when the live-transfer session finishes its intended data delivery successfully
- completion of a live-transfer session is not the same thing as creating a stored-transfer object

## 13. Failure Rule

A live-transfer session becomes `failed` when:

- transport negotiation fails
- active transfer breaks irrecoverably
- policy-allowed transport options are exhausted without success

Planning consequence:

- failure does not by itself create a stored object
- a later fallback handoff is a separate explicit domain transition

## 14. Expiry And Cancellation

### 14.1 Expiry

- `awaiting_join` sessions may expire if nobody joins in time
- active sessions may expire after excessive inactivity according to later operational tuning

### 14.2 Cancellation

- either participant may abandon the live-transfer session before completion
- cancellation should remain distinct from technical failure and from expiry

## 15. Retained Record Rule

Retention of live-transfer records is separate from session completion.

Planning rule:

- whether a completed, failed, or cancelled live-transfer session leaves a user-visible retained record depends on current confidentiality policy
- the live-transfer state machine itself must not assume retained history exists

## 16. Retained Record Content Baseline

When policy says live-transfer records are retained, the retained record may include:

- participant identity labels appropriate to the view
- session outcome
- timestamps
- transfer shape label
- transport outcome summary such as peer-to-peer succeeded or relay used

Planning rule:

- retained live-transfer records remain session records, not stored-transfer content records

## 17. Explicit Live-To-Stored Handoff

When live transfer fails and current policy allows stored-transfer fallback, `v1` should treat that fallback as:

- an explicit new stored-transfer handoff, not as silent continuation of the same lifecycle engine

### 17.1 Handoff Meaning

- the failed or abandoned live session remains a live-session record
- the fallback path creates a new stored-transfer flow through the ordinary stored-transfer preparation path
- the stored-transfer result becomes a proper `SourceItem` or related stored-transfer business object under normal stored-transfer rules

### 17.2 Why This Rule Exists

- it preserves the architectural boundary between live transfer and stored transfer
- it keeps history and policy interpretation understandable
- it prevents one hidden super-state-machine from absorbing both subsystems

## 18. Handoff Preconditions

Before live-to-stored fallback may begin:

- the original live-transfer session must have reached a failure or equivalent non-completion outcome
- current policy must allow live-to-stored fallback for the chosen confidentiality level
- the initiating user must still be allowed to create the stored-transfer object now

Planning rule:

- live-to-stored fallback is action-time policy evaluated, not guaranteed forever by the earlier live-session start

## 19. Handoff Result Shape

When fallback proceeds:

- the system should create a new stored-transfer flow under the ordinary stored-transfer pipeline
- the resulting object uses normal stored-transfer policy outputs, snapshots, lifecycle, and access packages
- if live-transfer records are retained, the retained live-session record should link conceptually to the later stored-transfer handoff outcome

## 20. Grouped And Large Live Transfer Rule

- grouped or large live transfer is allowed only when current policy explicitly permits it
- when not permitted, the product should block the live-transfer attempt rather than silently degrading into a larger hidden transport path
- the user may still be guided toward stored transfer when policy allows that path

## 21. Visibility And History Rule

- live-transfer session visibility should come from a live-transfer record model, not from pretending the session was always a stored-transfer object
- retained live-transfer records must remain distinguishable from stored `SourceItem` and `ShareObject` history

## 22. Cleanup Rule

- expired and failed session coordination data should be eligible for cleanup
- retained user-visible records, when policy allows retention, should remain separate from transient coordination cleanup

## 23. Security Red Lines

Implementation planning should not allow these shortcuts:

- do not merge live transfer into the stored-transfer lifecycle engine
- do not allow relay use when relay is disabled by policy
- do not treat live-to-stored fallback as implicit silent continuation of the same transfer object
- do not require relay to process decrypted content
- do not let retained live-transfer records masquerade as stored-transfer history objects

## 24. Follow-Up Planning Needed

The next planning work should still define:

- the exact session record schema and timeout values beyond the accepted first peer-to-peer timeout
- the exact retained-record fields for live-transfer history surfaces
- the API and realtime contract for session creation, join, confirmation, and transport updates
- the implementation sequencing note that places live transfer after the core stored-transfer foundation is stable
