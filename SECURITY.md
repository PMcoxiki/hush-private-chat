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

The concealment layer is intended only to reduce accidental disclosure during
casual inspection. It does not resist source-code review, network-traffic
analysis, a compromised device, or forensic examination. Public repository
names, MQTT metadata, and distributed build sources can reveal the product's
purpose. When the app moves to the background, the visible private conversation
is replaced with the local AI cover, but the active room remains in browser
process memory so it can be reopened from the sidebar. This also means the room
key and decrypted messages can remain in process memory during an ordinary app
switch and are not protected from device or memory forensics. Refreshing,
closing, or discarding the page ends that in-memory session and requires the
shared secret again. iOS can cover app-switcher snapshots when the scene becomes
inactive, but it cannot prevent a user from taking a screenshot while the app is
visible.

The native wrapper can schedule a generic local notification while its embedded
web client is still executing and receives a new peer message. The notification
bridge carries only a random message identifier; it does not carry the room
secret, room identifier, ciphertext, or plaintext. iOS may suspend the app and
its MQTT connection shortly after backgrounding, so this local notification is
not a guaranteed remote-push channel. Reliable delivery after suspension or a
force quit requires an APNs-enabled relay, signed push entitlements, and a
separate security review of device-token metadata and notification traffic.
