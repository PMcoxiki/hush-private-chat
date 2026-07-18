# Hush / ChatGPT-style private chat

An iPhone-first, two-person encrypted chat hidden behind a ChatGPT-like cover
conversation. Hold the `ChatGPT` model title for 900ms to reveal the shared
secret gate.

## What ships

- Responsive ChatGPT-style PWA with standalone iPhone installation.
- Static fallback PWA in `fallback/` that can be hosted on GitHub Pages without
  the Sites domain or a ChatGPT/OpenAI account.
- Downloadable `install.mobileconfig` Web Clip installer.
- Native SwiftUI/WKWebView Xcode project in `ios/` with the fallback client
  embedded for signed IPA builds that do not depend on web hosting at launch.
- Browser-side AES-256-GCM encryption and a ciphertext-only D1 timeline.
- Optional MQTT relay fallback with retained ciphertext messages and automatic
  failover between two public WebSocket relays.
- Versioned schema migrations, CI checks, PR template, CODEOWNERS, and security
  documentation.

## Security model

The shared secret is processed locally with 600,000-round PBKDF2-SHA-256. The
derived 512 bits are split between the AES key and opaque room identifier. The
server never receives the shared secret or message plaintext. Read
`SECURITY.md`: this prototype does not yet provide forward secrecy, device
verification, or an independently audited protocol.

The architecture and repository practices are mapped to concrete upstream
projects in `docs/github-case-studies.md`.

## Development

Use short-lived branches and Conventional Commits. Crypto and storage changes
require a security reviewer. The app intentionally has no ChatGPT/OpenAI login;
the shared room secret is the only private-conversation gate.

- `npm run dev` — local development
- `npm run dev:fallback` — standalone fallback PWA development
- `npm run lint` — static checks
- `npm test` — production build and product invariants
- `npm run build:fallback` — create the GitHub Pages artifact
- `npm run sync:ios-webapp` — rebuild and embed the fallback inside the Xcode app
- `npm run verify:install-target` — refuse a release when the iPhone target or
  PWA manifest is unavailable
- `npm run verify:relay` — verify two independent clients can decrypt the same
  retained ciphertext message through a live relay
- `npm run package:ios-source` — rebuild the self-contained Xcode source archive
  even before a public Web Clip target is available
- `npm run package:release` — rebuild the friend installer, native source zip,
  and SHA-256 checksums only after the public install target passes verification
- `npm run db:generate` — versioned D1 migration

For native packaging, open `ios/Hush.xcodeproj` with Xcode 16+, choose an Apple
Development team, then Archive and export using Ad Hoc, Development, or
TestFlight distribution.

Without a local Xcode installation, push the project to a private GitHub repo
and run the included `build unsigned iOS package` workflow. It produces an
unsigned IPA suitable for re-signing through AltStore or Sideloadly.

The `deploy encrypted web app` workflow publishes the standalone fallback to
GitHub Pages. The visible cover conversation is local and does not call GPT;
holding the `ChatGPT` title for 900ms opens the shared-secret gate.
