# iOS build

The native shell deliberately keeps cryptographic operations in the web client
so the relay receives ciphertext only. The Xcode target embeds the static
fallback under `Hush/WebApp` and loads it with WebKit's restricted local-file
API. The installed app can therefore start without depending on GitHub Pages or
the Sites domain, while its encrypted MQTT relay still requires a network.

Run `npm run sync:ios-webapp` after changing the fallback UI. The normal test
suite compares the embedded files with the current fallback build and fails if
the Xcode resources are stale.

Open `Hush.xcodeproj` in Xcode 16 or newer, select a personal or paid Apple
Development team, change the bundle identifier if needed, then Archive. For a
friend's device use an Ad Hoc provisioning profile containing that device UDID,
TestFlight, or let them sign the unsigned archive with AltStore/Sideloadly.

Do not claim that this prototype is an official OpenAI client. Public packages
use an independently designed knot icon; the ChatGPT-style cover label is only
a visual disguise and does not indicate affiliation with or access to OpenAI.

## Local message notifications

The native wrapper asks for notification permission after a private room is
opened. If the embedded room connection receives a new peer message while the
room is covered or the app is transitioning to the background, iOS presents a
generic “你有一条新回复” notification. Message text, room secrets, and room
identifiers are never included in the notification bridge or notification
content.

This is intentionally a local notification bridge, not APNs remote push. Once
iOS suspends or force-quits the app, its MQTT connection cannot receive a new
message and therefore cannot schedule a notification. Guaranteed background
delivery requires a paid Apple Developer signing setup, Push Notifications
entitlement, APNs credentials, and a notification relay that handles only opaque
metadata.

## Cloud unsigned build

The repository includes `.github/workflows/ios-unsigned.yml`. Push the source
to a private GitHub repository and run **build unsigned iOS package**. The
workflow uploads `ChatGPT-unsigned.ipa`, which can be re-signed with a personal
Apple ID using AltStore or Sideloadly. An unsigned IPA cannot be installed
directly; iOS always requires a valid signature and provisioning profile.
