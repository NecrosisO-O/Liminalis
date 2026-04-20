# Liminalis Confidentiality Impact Map

## Status

- Working map for the final confidentiality-policy pass

## Purpose

This document lists all product areas that either belong to confidentiality policy itself or may be affected by confidentiality level decisions.

It is intentionally broad so the final confidentiality design can be checked against the full product surface.

## 1. Strategy Body

- Resolved direction:
- confidentiality uses exactly three levels
- level names are fixed as secret, confidential, and top secret
- the three levels are centrally managed strategy groups rather than user-defined schemes
- the default level is configurable
- uploaded content may change level later
- later source-level changes affect future newly created shares but do not rewrite already derived shares

## 2. Send-Time Selection

- Resolved direction:
- the default send surface uses a lightweight confidentiality selector on the left side of the composer
- the advanced upload page uses a dropdown selector
- the current selector applies to both text and file sending in the current send context
- all send paths support confidentiality selection
- send-time switching does not trigger extra prompts or warnings
- all levels remain eligible for lightweight sending

## 3. Upload And Source-Item Lifecycle

- Resolved direction:
- default validity period should be configurable per level
- maximum validity period should be configurable per level
- whether a level allows never-expire behavior should be configurable
- all files allow manual deletion
- all files allow manual early invalidation
- whether validity may be extended later should be configurable
- all files allow manual shortening of validity
- validity is the same concept as the server-side retention window for stored content
- all files remain visible to trusted devices by default
- whether newly added trusted devices may view older content should be configurable
- manual deletion and manual early invalidation should be merged into one concept rather than treated as separate user-facing actions
- whether a source item may be outwardly reshared again should be configurable per confidentiality policy

## 4. Share Availability

- Resolved direction:
- whether a level may be shared at all is configurable
- which outward sharing methods are allowed for a level is configurable
- whether a level may be restricted to self-space only is configurable
- whether a recipient may reshare by level is configurable
- whether one source item may create multiple outward shares by level is configurable

- Remaining questions:
- whether and how the share-first entry path should interact with confidentiality policy, deferred because the share-first path itself may be excluded from the first version

## 5. User-Targeted Sharing Behavior

- Resolved direction:
- share default validity by level is configurable
- share maximum validity by level is configurable
- all share-validity behavior must remain constrained by the already-set source-item lifecycle rules
- sender revocation should always be allowed for shares
- direct user-targeted sharing remains single-recipient
- within the allowed validity window, repeated download is allowed
- no separate explicit "claim" step is required for the recipient
- the recipient may access the shared item across multiple trusted devices
- the recipient may see some content detail and metadata
- user-targeted sharing should not provide content preview before download
- for the common single-file case, the recipient-facing list view should show filename, file size, sender, expiry time, current status, and confidentiality level
- the recipient-facing detail view may additionally show file type, share time, receive time, repeat-download allowance, and invalidation reason when applicable

- Remaining questions:
- how single-recipient constraints should be understood for password extraction and public-link modes

## 6. Password Extraction

- Resolved direction:
- whether password extraction is allowed is controlled by confidentiality policy
- whether the password must be system-generated is determined by confidentiality policy
- system-generated passwords must be strong passwords with at least 24 characters including uppercase letters, lowercase letters, digits, and special characters
- custom passwords require at least 8 characters and do not impose further complexity requirements
- the allowed maximum number of retrievals is configurable
- the chosen retrieval count is selected at share time within the allowed maximum
- the share UI should only present the link and password, leaving the act of sending them to the user's own workflow
- after one failed password attempt, the system should require a captcha
- after successful password entry, recipient-visible metadata should follow the same model as user-targeted sharing

## 7. Public Links

- Resolved direction:
- whether public links are allowed is controlled by confidentiality policy
- public-link validity is chosen at share time, while the allowed maximum is configurable
- public-link download count is chosen at share time, while the allowed maximum is configurable
- public links should go directly to download and should not display metadata or other information before download
- public links should allow early revocation
- every generated public link should be tracked as its own managed object

## 8. Live Transfer

- Resolved direction:
- live transfer should be constrained by confidentiality policy
- whether a level allows live transfer is configurable
- whether a level allows peer-to-peer transport is configurable
- whether a level allows relay transport is configurable
- whether peer-to-peer failure may fall back to relay is configurable
- whether live-transfer failure may fall back to normal stored transfer is configurable
- whether live-transfer records are retained is configurable
- whether a level allows grouped content or large-file live transfer is configurable

## 9. Retrieval And Download

- Resolved direction:
- repeated download is allowed for user-targeted shares within the allowed validity window
- retrieval count is configurable for password extraction and public links at share time within configured maximums
- no extra level-specific retrieval restriction has been defined beyond the share-mode-specific rules
- on trusted devices, filenames and sizes remain visible regardless of level unless another explicit rule overrides them

## 10. Burn-After-Read

- Resolved direction:
- burn-after-read remains an additional option rather than being inherently bound to confidentiality level
- burn-after-read should be available as an option at upload/send time
- for files, burn-after-read should trigger when one device successfully downloads and decrypts the content
- for text messages, burn-after-read may use an explicit "read" action such as a dedicated seen button
- burn-after-read may apply both to ordinary uploaded objects and to share objects, depending on where the option was enabled
- after burn-after-read triggers, the system should remove the relevant in-product traces rather than leaving historical remnants or metadata
- local copies produced by a deliberate user-side save or export are outside the system's ability to erase and are treated as a user-protection responsibility
- for self-space uploads, burn-after-read may remove online availability for other devices after the first successful decryption

## 11. Main Timeline Presentation

- Resolved direction:
- confidentiality level should not reduce what trusted devices may view in the active timeline
- filenames, text visibility, source metadata, and other normal active-timeline information do not need extra per-level restrictions merely because of confidentiality level
- timeline presentation may still vary visually by level, but not in basic access to visible information on trusted devices

## 12. Detailed History Presentation

- Resolved direction:
- confidentiality level should not reduce what trusted devices may view in detailed history
- text content may remain fully viewable on trusted devices regardless of confidentiality level unless another explicit product rule says otherwise
- filenames, summaries, and metadata remain visible on trusted devices regardless of confidentiality level
- search may match high-level content on trusted devices regardless of confidentiality level

## 13. Metadata Exposure

- Resolved direction:
- on trusted devices, confidentiality level does not add extra metadata-hiding rules by itself
- filenames, file sizes, source names, timestamps, and other ordinary metadata remain visible on trusted devices unless another explicit product rule says otherwise

## 14. Trusted Devices And Recovery

- Resolved direction:
- whether newly added trusted devices may access older content is configurable per level
- recovery should unlock all historical levels equally
- no additional stronger post-recovery handling is required for higher levels

## 15. Admin Configuration

- Resolved direction:
- the confidentiality-policy management page should have a compact global header plus three fixed level tabs
- the global header should contain only the default confidentiality level selector and a restore-defaults action
- the three fixed tabs should correspond to secret, confidential, and top secret
- each level tab should be organized into lifecycle, share availability, user-targeted sharing, password extraction, public links, and live transfer sections
- the lifecycle section should include default validity, maximum validity, allow-never-expire, allow-validity-extension, visibility to newly added trusted devices, and allow-outward-resharing
- the share-availability section should include allow-outward-sharing, self-only restriction, allow-recipient-resharing, allow-multiple-outward-shares, and per-method allow toggles for user-targeted sharing, password extraction, and public links
- the user-targeted-sharing section should include default share validity, maximum share validity, allow-repeat-download, and allow-recipient-multi-device access
- the password-extraction section should include allow-password-extraction, require-system-generated-password, and maximum retrieval count
- the public-links section should include allow-public-links, maximum public-link validity, and maximum public-link download count
- the live-transfer section should include allow-live-transfer, allow-peer-to-peer, allow-relay, allow-peer-to-peer-to-relay fallback, allow-live-to-stored fallback, retain-live-transfer-records, and allow-grouped-or-large live transfer
- fixed system rules should not appear as editable per-level fields on this page

## 16. Mandatory Versus Optional Controls

- Resolved direction:
- all confidentiality levels should allow all additional optional policies
- additional optional policies should not be enabled by default for any level

## Notes

- The confidentiality policy body is now largely settled.
- The remaining deferred item is how the share-first entry path should interact with confidentiality policy.
