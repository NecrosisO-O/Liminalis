# Liminalis Confidentiality Default Presets

## Status

- Accepted draft for the built-in default confidentiality configuration

## Global Default

- Default confidentiality level: `secret`

## Secret

### Lifecycle

- Default validity: 12 hours
- Maximum validity: never expire allowed
- Allow outward resharing from the source item: yes
- Allow validity extension later: yes
- Newly added trusted devices may view older content: yes

### Share Availability

- Allow sharing: yes
- Restrict to self only: no
- Allow recipient resharing: no
- Allow multiple outward shares from one source item: yes
- Allow user-targeted sharing: yes
- Allow password extraction: yes
- Allow public links: yes

### User-Targeted Sharing

- Default share validity: 8 hours
- Maximum share validity: unlimited, still constrained by source-item lifecycle rules
- Allow repeat download: yes
- Allow recipient multi-device access: yes

### Password Extraction

- Allow password extraction: yes
- Require system-generated password: no
- Maximum retrieval count: 5

### Public Links

- Allow public links: yes
- Maximum public-link validity: 24 hours
- Maximum public-link download count: 5

### Live Transfer

- Allow live transfer: yes
- Allow peer-to-peer: yes
- Allow relay: yes
- Allow peer-to-peer to relay fallback: yes
- Allow live-transfer failure to fall back to normal stored transfer: yes
- Retain live-transfer records: yes
- Allow grouped or large live transfer: yes

## Confidential

### Lifecycle

- Default validity: 2 hours
- Maximum validity: 24 hours
- Allow never expire: no
- Allow validity extension later: yes
- Newly added trusted devices may view older content: yes
- Allow outward resharing from the source item: yes

### Share Availability

- Allow sharing: yes
- Restrict to self only: no
- Allow recipient resharing: no
- Allow multiple outward shares from one source item: yes
- Allow user-targeted sharing: yes
- Allow password extraction: yes
- Allow public links: no

### User-Targeted Sharing

- Default share validity: 2 hours
- Maximum share validity: 24 hours, still constrained by source-item lifecycle rules
- Allow repeat download: yes
- Allow recipient multi-device access: yes

### Password Extraction

- Allow password extraction: yes
- Require system-generated password: yes
- Maximum retrieval count: 3

### Public Links

- Allow public links: no
- Maximum public-link validity: not applicable under the built-in confidential preset
- Maximum public-link download count: not applicable under the built-in confidential preset

### Live Transfer

- Allow live transfer: yes
- Allow peer-to-peer: yes
- Allow relay: yes
- Allow peer-to-peer to relay fallback: yes
- Allow live-transfer failure to fall back to normal stored transfer: no
- Retain live-transfer records: yes
- Allow grouped or large live transfer: yes

## Top Secret

### Lifecycle

- Default validity: 10 minutes
- Maximum validity: 1 hour
- Allow never expire: no
- Allow validity extension later: no
- Newly added trusted devices may view older content: no
- Allow outward resharing from the source item: no

### Share Availability

- Allow sharing: no
- Restrict to self only: yes
- Allow recipient resharing: no
- Allow multiple outward shares from one source item: no
- Allow user-targeted sharing: no
- Allow password extraction: no
- Allow public links: no

### User-Targeted Sharing

- Not applicable under the built-in top-secret preset

### Password Extraction

- Not applicable under the built-in top-secret preset

### Public Links

- Not applicable under the built-in top-secret preset

### Live Transfer

- Allow live transfer: yes
- Allow peer-to-peer: yes
- Allow relay: no
- Allow peer-to-peer to relay fallback: no
- Allow live-transfer failure to fall back to normal stored transfer: no
- Retain live-transfer records: no
- Allow grouped or large live transfer: yes
