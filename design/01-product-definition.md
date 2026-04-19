# Liminalis Product Definition

## Status

- Draft: near design closure

## Working Product Statement

`Liminalis` is a file transfer assistant focused on making file movement between devices, people, and environments feel low-friction, dependable, and flexible.

The phrase "almost universal" means the product should aim to support many transfer situations without forcing users to understand the underlying transport details each time.

In the current design direction, `Liminalis` is organized around a cloud-hosted service and multiple connected devices acting as nodes.

## Problem Framing

File transfer is often fragmented across different tools and assumptions:

- sending to your own devices is easy in some ecosystems and awkward in others
- sending to another person is fast in chat tools but weak for large or structured transfers
- moving files across different networks often requires setup, workarounds, or third-party storage
- users often do not know which method is best for size, speed, privacy, or reliability

## Design Goal

Help users complete a transfer with the least possible setup while preserving clarity about what is being sent, where it is going, and whether it succeeded.

The first baseline should work through the browser so users on different devices can open a webpage and complete upload and download without needing a native client.

The product's basic anchor is sending to self. That flow should be the most immediate and visible experience when the user enters the web app.

Within send-to-self, the default transfer behavior should favor encrypted temporary holding rather than requiring both devices to be online at the same time.

## Product Goals

- Reduce the number of decisions users must make before a transfer starts
- Support both quick sharing and more deliberate handoff workflows
- Handle single files, multiple files, and folders gracefully
- Support both file transfer and text message delivery
- Treat text as a first-class transfer object rather than a minor note field
- Make transfer state visible: preparing, sending, paused, resumed, failed, completed
- Stay useful across different devices and network conditions
- Preserve end-to-end encryption across protected transfer flows, with public-link sharing as an explicit convenience exception

Text messages belong to the stored transfer experience rather than online direct transfer, and they are not part of outward sharing.

Public-link sharing is a deliberate convenience exception: it is allowed to prioritize frictionless retrieval over strict end-to-end guarantees.

## Product Principles

### 1. Convenience first, but not opaque

The product should automate the hard parts, but users should still understand the destination, visibility, and status of a transfer.

### 2. Progressive capability

Simple cases should stay simple, while harder cases can unlock more advanced options only when needed.

This especially applies to the split between sending to self and sending to others: the self-flow should be immediately available, while the other-person flow can require additional steps.

### 3. Assistant, not just pipe

`Liminalis` should help choose, prepare, and manage transfers instead of acting like a thin upload form.

### 4. Cross-context usefulness

The product should feel relevant whether the user is sending to self, sending to others, moving project assets, or bridging awkward network situations.

### 5. Reliability is part of usability

Resuming, retrying, and preserving user confidence matter as much as raw speed.

### 6. Encryption is foundational

The service may coordinate transfer, routing, and temporary storage, but protected transfer content should remain end-to-end encrypted rather than merely protected in transit. Public-link delivery is the explicit convenience exception.

### 7. Inbox-style continuity

For send-to-self, users should be able to treat outgoing encrypted payloads as an available list across their own logged-in devices, rather than as one-off point deliveries that vanish from view.

### 8. Security should be selectable without feeling heavy

Uploads should be able to carry a confidentiality level and optional self-destruct behavior, so that stronger protection can be chosen at send time without turning every transfer into a complex manual setup.

Security-sensitive features should also allow selective enablement or disablement where appropriate, because some environments may need stronger protection while others may need fewer barriers to use.

## Value Proposition

Instead of asking users to pick a separate tool for each transfer situation, `Liminalis` should become the place they start whenever they need to move files quickly and confidently.

## Early Success Criteria

- Users can understand the transfer model quickly
- Common transfers require little setup
- Failure states are recoverable and clearly explained
- The product feels broader than a single sharing method, but simpler than a toolbox of unrelated features
