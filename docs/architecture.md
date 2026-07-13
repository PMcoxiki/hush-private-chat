# Hush architecture

## Security boundary

The browser encrypts message content before transport. D1 stores only a room
identifier, sender device identifier, AES-GCM ciphertext, IV, and timestamp.
The server never receives the shared secret or plaintext.

This prototype uses a password-derived room key. Production iOS should replace
that with audited Signal Protocol primitives, per-device identity keys stored in
Keychain/Secure Enclave, Double Ratchet sessions, device verification, key
rotation, replay protection, and push notifications containing no plaintext.

## Components

- `app/page.tsx`: cover AI experience, covert unlock gesture, encrypted room UI.
- `app/api/messages/route.ts`: opaque ciphertext relay and durable history.
- `db/schema.ts`: persistence contract and timeline index.
- Cloudflare D1: encrypted message envelope storage.

## Influences

- Signal libsignal: platform wrappers around a shared Rust cryptographic core,
  Double Ratchet sessions, and separate account/device key responsibilities.
- Matrix JS SDK / Element: room timelines, local echo, retry-oriented delivery,
  persistent crypto stores, cross-signing, and device verification.

## Decisions

1. Plaintext is never sent to the API.
2. UI camouflage and cryptographic security are independent layers.
3. Database migrations are versioned with the source.
4. Crypto changes require tests, threat-model review, and a dedicated reviewer.
