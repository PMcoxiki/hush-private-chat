# Hush architecture

## Security boundary

The browser encrypts message content before transport. D1 stores only a room
identifier, sender device identifier, AES-GCM ciphertext, IV, and timestamp.
The server never receives the shared secret or plaintext.

This prototype derives 512 bits from the shared secret with 600,000-round
PBKDF2-SHA-256, then separates the AES key material from the opaque room id.
Production iOS should replace
that with audited Signal Protocol primitives, per-device identity keys stored in
Keychain/Secure Enclave, Double Ratchet sessions, device verification, key
rotation, replay protection, and push notifications containing no plaintext.

## Components

- `app/page.tsx`: cover AI experience, covert unlock gesture, encrypted room UI.
- `app/lib/chat-crypto.ts`: client-only key derivation and AES-GCM operations.
- `app/api/messages/route.ts`: opaque ciphertext relay and durable history.
- `app/install.mobileconfig/route.ts`: removable iOS Web Clip installer.
- `ios/`: app-bound SwiftUI wrapper prepared for Apple signing.
- `db/schema.ts`: persistence contract and timeline index.
- Cloudflare D1: encrypted message envelope storage.
- `fallback/`: static PWA that lazy-loads its MQTT transport only after the
  hidden gate opens.
- Public MQTT relay fallback: retained AES-GCM envelopes only; no plaintext,
  shared secret, or sender identity is present outside the encrypted payload.

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
5. The cover UI is local simulation only and never authenticates with or calls
   ChatGPT/OpenAI.
6. Public relay mode is an availability fallback, not the production security
   target; the native roadmap remains audited Signal Protocol primitives.
