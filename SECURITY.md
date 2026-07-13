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
