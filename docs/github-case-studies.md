# GitHub case studies and adoption record

This project studies proven open-source messaging systems for architecture and
delivery practices. It does not copy their protocol code or claim protocol
compatibility.

## Signal / libsignal

Source: [signalapp/libsignal](https://github.com/signalapp/libsignal)

- Proven idea: keep protocol primitives in a shared, reviewed cryptographic core
  and expose platform-specific Swift/TypeScript bindings.
- Adopted now: cryptography is isolated from UI and transport, with test vectors
  for key derivation and authenticated-encryption round trips.
- Required before high-risk use: replace the prototype shared-key channel with
  an audited protocol that provides identity keys, Double Ratchet sessions,
  forward secrecy, replay protection, and device verification.

## Matrix JS SDK / Element

Sources: [matrix-org/matrix-js-sdk](https://github.com/matrix-org/matrix-js-sdk),
[element-hq/element-web](https://github.com/element-hq/element-web)

- Proven idea: model a chat as a room timeline, show local echo immediately,
  merge server history deterministically, and make reconnect/retry explicit.
- Adopted now: stable message IDs, timestamp ordering, local echo, retained
  history replay, transport status, and reconnect behavior.
- Deliberately deferred: accounts, federation, multi-device cross-signing, and
  the larger Matrix trust model are outside this two-person prototype.

## SimpleX Chat

Source: [simplex-chat/simplex-chat](https://github.com/simplex-chat/simplex-chat)

- Proven idea: a private connection does not need a globally searchable user
  identity; invitation material can establish a pairwise channel through relays.
- Adopted now: there is no friend login or public user identifier. A high-entropy
  shared secret derives an opaque room address and a separate encryption key.
- Important difference: this fallback uses commodity public MQTT relays and
  retained messages. It does not inherit SimpleX metadata protections, queue
  isolation, delivery deletion, security codes, or audited double-ratchet design.

## Repository practices adopted here

- Conventional Commits and short-lived `codex/*` branches.
- Product-invariant tests for the hidden 900 ms entry gesture, no GPT/login
  dependency, ciphertext-only transport, install metadata, and deployment URL
  consistency.
- Separate GitHub Actions workflows for the static Pages release and unsigned
  iOS build.
- Reproducible release packaging from tracked source files, plus SHA-256
  checksums for generated artifacts.
- Explicit security limitations in `SECURITY.md`; protocol and signing changes
  require review rather than being treated as ordinary UI edits.
