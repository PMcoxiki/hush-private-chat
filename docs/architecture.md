# Hush architecture

## Security boundary

The browser encrypts the complete message envelope before transport. The v3 D1
table stores only an opaque room identifier, random message identifier,
AES-GCM ciphertext, and IV. Sender identity, message text, and the client
timestamp stay inside the ciphertext. The server never receives the shared
secret or plaintext.

This prototype derives 512 bits from the shared secret with 600,000-round
PBKDF2-SHA-256, then separates the AES key material from the opaque room id.
Production iOS should replace
that with audited Signal Protocol primitives, per-device identity keys stored in
Keychain/Secure Enclave, Double Ratchet sessions, device verification, key
rotation, replay protection, and push notifications containing no plaintext.

## Components

- `app/page.tsx`: Sites client wired to the shared durable room transport.
- `shared/chat-crypto.ts`: canonical v3 key derivation and AES-GCM operations.
- `shared/durable-room.ts`: paginated durable history and client-side v2 migration.
- `app/api/messages/route.ts`: CORS-enabled opaque ciphertext relay and durable history.
- `app/install.mobileconfig/route.ts`: removable iOS Web Clip installer.
- `ios/`: app-bound SwiftUI wrapper prepared for Apple signing.
- `db/schema.ts`: persistence contract and timeline index.
- Cloudflare D1: encrypted message envelope storage.
- `fallback/`: static PWA and native embedded client that use D1 for durable
  ciphertext history and lazy-load MQTT only after the hidden gate opens.
- Public MQTT relays: fixed, independent compatibility readers for legacy
  retained ciphertext plus best-effort realtime delivery. New history is
  authoritative in D1; the clients never rotate between unrelated brokers.

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
7. Sites, Pages, PWA, and iOS derive the same v3 room from the same shared
   secret. A client that can decrypt legacy v2 data re-encrypts it locally
   before uploading it to the v3 ciphertext table.
