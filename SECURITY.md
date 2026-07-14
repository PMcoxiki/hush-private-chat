# Security policy

Do not report security vulnerabilities in public issues. Share a minimal
reproduction privately with the maintainers and avoid including real secrets or
message content.

## Prototype limitations

This build demonstrates browser-side encryption with a shared passphrase. It is
not yet a substitute for an independently audited secure messenger. It has no
forward secrecy, device verification, key rotation, metadata protection,
traffic-shaping, abuse controls, or recovery flow. A production release must use
an audited protocol implementation such as libsignal and receive an independent
security assessment.

The GitHub Pages fallback uses public MQTT relays as an availability bridge.
Those relays receive only an opaque room identifier, random message topic, and
AES-GCM ciphertext, but they can still observe timing, message size, IP address,
and room activity. Retained-message durability is best-effort and public relay
operators can delete data or stop service without notice. Do not treat this
fallback as equivalent to Signal Protocol or use it for high-risk conversations.
