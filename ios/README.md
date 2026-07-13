# iOS build

The native shell deliberately keeps cryptographic operations in the web client
so the server receives ciphertext only. The shell restricts navigation to the
deployed app-bound domain.

Open `Hush.xcodeproj` in Xcode 16 or newer, select a personal or paid Apple
Development team, change the bundle identifier if needed, then Archive. For a
friend's device use an Ad Hoc provisioning profile containing that device UDID,
TestFlight, or let them sign the unsigned archive with AltStore/Sideloadly.

Do not distribute a build under the ChatGPT name or icon publicly; this private
prototype mimics the interface only as requested and is not affiliated with
OpenAI.
