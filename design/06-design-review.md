# Liminalis Design Review

## Status

- Design-phase review snapshot
- Historical design-closure snapshot; later accepted architecture and implementation-planning notes refine this review into the current working `v1` baseline

## Overall State

- The design phase has produced a coherent product model for `Liminalis`
- The main product surfaces, user roles, sharing modes, trusted-device model, admin model, and confidentiality model are now largely defined
- The remaining work is concentrated in a small number of deferred or final-polish areas rather than large unresolved product questions

## Major Areas Settled

- send-to-self as the default product anchor
- distinct send-to-others mode with shared underlying stored-ciphertext path
- browser-first, web-only initial release
- cloud service plus connected device-node model
- trusted-device account model with QR-first pairing, short-code fallback, and recovery codes
- layered sharing modes: user-targeted sharing, password extraction, and public links
- separate admin panel with strong boundaries from user content
- IM-like active timeline with transfer-oriented behavior
- advanced upload, detailed history, and live-transfer as distinct secondary surfaces
- confidentiality policy based on three fixed levels with centrally managed strategy bundles

## Main Deferred Items

- how the share-first entry path should interact with confidentiality policy

## Expected Next Phase Inputs

- architecture should now be able to derive module boundaries from the settled product model
- the deferred items above should either be finalized first or carried as explicit architecture assumptions

## Later Baseline Notes

- The deferred share-first item was carried forward as an explicit `v1` exclusion rather than re-opened during implementation planning.
- The later architecture and implementation-planning corpus now expands the settled product model here into explicit domain objects, state rules, security boundaries, policy-engine behavior, and read-model boundaries.
