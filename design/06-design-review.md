# Liminalis Design Review

## Status

- Design-phase review snapshot

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
