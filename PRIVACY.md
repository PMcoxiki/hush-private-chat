# Privacy Policy

Last updated: July 20, 2026

Hush Private Chat provides an offline consultation interface and an optional
shared-secret encrypted chat room. It does not use GPT, the OpenAI API, ads,
analytics, or cross-app tracking.

## Data processed on your device

- Cover conversations and settings are stored locally on your device.
- A room secret is used locally to derive an opaque room identifier and an
  AES-GCM encryption key. The secret is not sent to the relay.
- Message text, sender information, and client timestamps are encrypted on the
  device before transmission and decrypted only on clients that have the same
  secret.

## Data handled by relays

The relay infrastructure may receive and retain opaque room identifiers, random
message identifiers, initialization vectors, ciphertext, and ordinary network
metadata such as IP address, timing, and message size. Relay operators cannot
decrypt message content without the shared secret. The static web and iOS
clients may also use public MQTT brokers for availability; those brokers may
retain encrypted messages and network metadata indefinitely, and Hush cannot
guarantee deletion from them.

## Notifications

The iOS wrapper can create a generic local notification while it is still
running. Notification content does not include a room secret, room identifier,
or message text. This release does not register a device token with a remote
push provider.

## Your choices

You choose whether to open an encrypted room and which secret to share. Clearing
the app's website data or uninstalling the app removes locally stored cover
history and settings. It may not remove ciphertext already retained by relay or
broker infrastructure.

## Security limitations

This prototype has not received an independent cryptographic audit and does not
provide forward secrecy, device verification, account recovery, or metadata
protection. Do not use it for high-risk communications. Additional limitations
are documented in [SECURITY.md](SECURITY.md).

## Contact

For privacy questions, use a [private GitHub security advisory](https://github.com/PMcoxiki/hush-private-chat/security/advisories/new). Do not include a real room secret or message content in support requests.
