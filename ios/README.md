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

## Cloud unsigned build

The repository includes `.github/workflows/ios-unsigned.yml`. Push the source
to a private GitHub repository and run **build unsigned iOS package**. The
workflow uploads `ChatGPT-unsigned.ipa`, which can be re-signed with a personal
Apple ID using AltStore or Sideloadly. An unsigned IPA cannot be installed
directly; iOS always requires a valid signature and provisioning profile.
