# Hush / ChatGPT-style private chat

An iPhone-first, two-person encrypted chat hidden behind a ChatGPT-like cover
conversation. Hold the `ChatGPT 5.2` model title for 900ms to reveal the shared
secret gate.

## What ships

- Responsive ChatGPT-style PWA with standalone iPhone installation.
- Downloadable `install.mobileconfig` Web Clip installer.
- Native SwiftUI/WKWebView Xcode project in `ios/` for signed IPA builds.
- Browser-side AES-256-GCM encryption and a ciphertext-only D1 timeline.
- Versioned schema migrations, CI checks, PR template, CODEOWNERS, and security
  documentation.

## Security model

The shared secret is processed locally with 600,000-round PBKDF2-SHA-256. The
derived 512 bits are split between the AES key and opaque room identifier. The
server never receives the shared secret or message plaintext. Read
`SECURITY.md`: this prototype does not yet provide forward secrecy, device
verification, or an independently audited protocol.

## Development

Use short-lived branches and Conventional Commits. Crypto and storage changes
require a security reviewer. The app intentionally has no ChatGPT/OpenAI login;
the shared room secret is the only private-conversation gate.

- `npm run dev` — local development
- `npm run lint` — static checks
- `npm test` — production build and product invariants
- `npm run db:generate` — versioned D1 migration

For native packaging, open `ios/Hush.xcodeproj` with Xcode 16+, choose an Apple
Development team, then Archive and export using Ad Hoc, Development, or
TestFlight distribution.

Without a local Xcode installation, push the project to a private GitHub repo
and run the included `build unsigned iOS package` workflow. It produces an
unsigned IPA suitable for re-signing through AltStore or Sideloadly.
