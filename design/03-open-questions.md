# Liminalis Open Questions

## Status

- Active during design phase

## Product Direction

- How much of the product should explicitly reflect the self-hosted owner context versus hiding it behind a generic user experience?
- Should the first version optimize for speed of sharing or control and reliability?

Note: the current direction already treats send-to-self as the product's basic anchor, while send-to-others is a separate mode.

## Platform Strategy

- Which clients matter first: web, desktop, mobile, or command line?
- Is the first release expected to work cross-platform from day one?
- Is installation acceptable, or should the first experience be as close to zero-install as possible?

## Transfer Model

- In the dedicated live-transfer mode, when should relay be used versus peer-to-peer transport?
- Are temporary links a core primitive, or just one delivery mode among several?
- How important is resumable transfer in the first version?
- How different should the transfer lifecycle be between send-to-self and send-to-others?
- In send-to-others, is sharing applied after upload by default, or can sharing intent be chosen before upload as well?
- In live transfer, what file-selection and session controls are needed now that text is excluded from the mode?

Note: confidentiality policy details are intentionally deferred until other product design areas are settled.

## Trust And Privacy

- What privacy baseline should users expect?
- Should end-to-end encryption be a product requirement, an optional mode, or out of scope initially?
- What metadata is acceptable for the system to retain?
- How are encryption keys established between browser-based nodes and recipients?
- What identity or access mechanism proves that the intended recipient can decrypt a payload?
- If the server temporarily stores ciphertext, what lifecycle and deletion guarantees are expected?
- For user-targeted sharing, how is recipient identity bound to decryption rights?
- For password extraction, how should weak passwords and password leakage be handled at the product level?
- For public links, what warning or labeling should make it clear that this is a convenience mode outside the strict end-to-end encrypted path?
- What boundaries separate admin-only capabilities from normal transfer capabilities?
- What information should the administrator see during approval, and what should remain private?
- What, if anything, should happen beyond server-side invalidation when a sender revokes or deletes a shared item that may already be downloaded locally?
- Which policy differences are enforced cryptographically versus only at the application layer?
- Should the product intentionally encourage sending the link and password through separate channels?
- Should password generation rules be tied to confidentiality level, and if so, how?
- Which security-related controls should be mandatory, and which should be optional toggles?
- Which trust-onboarding safeguards should be mandatory by default and which should remain user-configurable?

## Interaction Design

- What extra step should move the user from send-to-self into send-to-others?
- Should the IM-like home view behave more like a message timeline, a transfer inbox, or a hybrid of both?
- How should grouped files, large payloads, and repeated downloads appear in an IM-like interface?
- What is the right boundary between the lightweight default composer and the dedicated advanced upload page?
- What record details should appear in the detailed list for expired or self-destructed content?
- How should the share action present the three delivery styles without making the flow feel overloaded?
- How visible should the secondary "share-first" path be compared with the default item-first sharing path?
- Should the UI visibly distinguish administrator areas from normal transfer areas, and if so, how strongly?
- What exact waiting-state information should an invited but not-yet-approved user see after registration?
- How much sender and device context should appear in each timeline item without making the view noisy?
- How should the generated link and extraction password be displayed and copied in the share UI?
- In online direct transfer, what participant information should be shown if self-device transfer and user-to-user transfer share one unified session model?
- How should the trusted-device approval page present QR pairing, short-code fallback, and recovery without confusion?

Note: the current recovery direction is a set of three grouped recovery codes, each 20 characters long, using only non-ambiguous letters and digits.

Note: after recovery-code rotation, the continue action should remain disabled behind a five-second countdown.

Note: the current retrieval-page direction is password first, metadata second, then explicit download.

Note: the current public-link direction is direct download with minimal or no intermediate presentation.

Note: detailed confidentiality-policy mapping remains intentionally deferred until handled as a dedicated later design pass.

## Administration

- What capabilities belong in the separate server-management panel versus the main transfer product?
- How should administrators enter or discover the management panel without making the everyday interface feel operationally heavy?

Note: confidentiality policy is now intended to be centrally defined by the administrator at the instance level rather than customized per user.

Note: the detailed contents of the confidentiality-policy management page remain intentionally deferred until the later dedicated pass.

## Product Boundaries

- How far should "almost universal" go before the product becomes unfocused?
- What use cases should be intentionally excluded from the first version?
