# Liminalis Code-Phase Macro Plan

## Status

- Recorded execution-phase macro plan
- Execution not started; code work still requires explicit user instruction

## Purpose

This document records the macro execution plan for the upcoming code phase.

It does not authorize implementation by itself. Its role is to preserve the agreed execution shape so the repository has a stable record before code work begins.

## 1. Execution Principles

- code work should follow the accepted implementation-planning corpus in `design/16` through `design/35`
- code work should begin only after explicit user instruction
- execution should follow the accepted milestone order rather than picking isolated features opportunistically
- protected-flow boundaries, state semantics, and policy semantics should be preserved even when they increase implementation cost
- all automatable tests should be run before final reporting at the end of the code phase
- only genuinely human-dependent validation should remain for later manual checking

## 2. Execution Batches

The planned code phase should proceed through these macro batches.

### Batch 1: Foundation

Includes:

- `M1` identity, admission, session, and first trusted-device entry
- `M2` trust expansion, recovery core, public wrapping publication, and access substrate foundation

Primary intent:

- establish account identity, trusted-device boundaries, recovery behavior, and structural protected-access foundations before content flows exist

### Batch 2: Stored Core

Includes:

- `M3` policy evaluation and stored-transfer creation
- `M4` protected self retrieval and core lifecycle jobs

Primary intent:

- deliver the first complete protected stored-transfer path for self-space content before outward sharing breadth is added

### Batch 3: Read Models

Includes:

- `M5` active timeline, detailed history, and narrow search

Primary intent:

- make the product usable as an everyday self-space system once the write-side core is stable

### Batch 4: Share Modes

Includes:

- `M6` user-targeted protected sharing
- `M7` password extraction and public links

Primary intent:

- add outward delivery breadth only after the protected self path and read-model foundation are stable

### Batch 5: Control, Realtime, And Polish

Includes:

- `M8` admin control-plane completion
- `M9` live transfer and explicit stored fallback
- `M10` resilience and maintenance polish

Primary intent:

- finish instance control-plane capability, add the secondary live-transfer subsystem, and close late resilience edges

## 3. Batch-Level Outcomes

### Batch 1 Outcome

- users can register, authenticate, be approved or disabled, establish trusted devices, pair new browsers, recover access, and publish the public wrapping material needed for later protected sharing

### Batch 2 Outcome

- users can create protected self-space source items through upload preparation, ciphertext-part upload, and finalization-before-activation, then retrieve them safely through the protected retrieval model

### Batch 3 Outcome

- users can use active timeline, retained history, and narrow trusted-device search over the stable self-space write model

### Batch 4 Outcome

- users can create outward share objects and use user-targeted protected sharing, password extraction, and public links as sibling delivery modes

### Batch 5 Outcome

- administrators can complete the intended control-plane workflows, live transfer exists as a distinct subsystem with explicit stored fallback, and maintenance/resilience edges are hardened

## 4. Testing Strategy

The code phase should use three testing layers.

### Unit Tests

- domain objects and state transitions
- policy evaluation rules
- `AccessGrantSet` and package-family logic
- retrieval accounting and count consumption rules

### Integration Tests

- registration and approval
- trusted-device onboarding and recovery
- upload and source finalization
- protected self retrieval
- share creation and outward delivery modes
- admin policy publication and enforcement

### End-To-End Tests

- self-space upload and retrieval happy path
- pending, blocked, untrusted, and trusted entry routing
- retained history and search behavior
- outward sharing flows
- admin control-plane core workflows

## 5. Human-Dependent Validation To Leave For Later

Only these categories should remain for later manual confirmation when the code phase is done:

- real-device QR pairing experience
- real browser save/download behavior across environments
- live transfer behavior across real network conditions and two-device coordination
- final visual and interaction quality of key product surfaces

## 6. Execution Red Lines

- do not start implementation without explicit user instruction
- do not skip milestone ordering for convenience
- do not weaken protected-flow semantics merely to accelerate coding
- do not let admin or read-model surfaces redefine write-side truth
- do not let live transfer merge into the stored-transfer core lifecycle

## 7. Primary Source Of Truth For Code Work

When implementation eventually starts, code work should primarily follow:

- `design/16` through `design/35`

The original design-phase documents `design/01` through `design/08` should remain reference material for product intent and UX calibration, not the primary rule source for code behavior.

## 8. Start Condition

Execution should begin only when the user gives an explicit instruction to start code work.
