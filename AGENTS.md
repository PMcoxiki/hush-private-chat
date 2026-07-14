# Repository working agreement

## Product invariants

- The visible cover must remain recognizably ChatGPT-like and must not call GPT.
- No ChatGPT/OpenAI account, friend account, or app login is part of the room flow.
- Shared secrets and plaintext messages never leave the client.
- Transport and persistence may contain only opaque identifiers and ciphertext.

## Change workflow

- Use short-lived branches and Conventional Commits.
- Keep commits scoped to one product, security, or release concern.
- Require review for cryptography, relay, storage, service-worker, and signing changes.
- Do not commit real room keys, message exports, signing certificates, or tokens.

## Required verification

- Run `npm test` for every product change.
- Run `npm run lint` before release.
- Verify the cover conversation and 900ms hidden-entry gesture at an iPhone viewport.
- Verify two independent clients using the same key can decrypt the same retained message.
- Record known security limitations in `SECURITY.md` rather than hiding them.

## Release surfaces

- Sites deployment is the durable D1-backed implementation.
- GitHub Pages is the static fallback implementation.
- The Xcode project is the native wrapper; unsigned IPA artifacts require re-signing.
