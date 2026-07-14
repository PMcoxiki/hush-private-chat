# iOS build

The native shell deliberately keeps cryptographic operations in the web client
so the relay receives ciphertext only. The shell loads the GitHub Pages fallback
at `https://pmcoxiki.github.io/hush-private-chat/` and restricts top-level
navigation to that app-bound domain.

If the repository name or deployment URL changes, update both
`AppConfiguration.webURL` in `Hush/HushApp.swift` and `WKAppBoundDomains` in
`Hush/Info.plist` before building.

Open `Hush.xcodeproj` in Xcode 16 or newer, select a personal or paid Apple
Development team, change the bundle identifier if needed, then Archive. For a
friend's device use an Ad Hoc provisioning profile containing that device UDID,
TestFlight, or let them sign the unsigned archive with AltStore/Sideloadly.

Do not distribute a build under the ChatGPT name or icon publicly; this private
prototype mimics the interface only as requested and is not affiliated with
OpenAI.

## Cloud unsigned build

The repository includes `.github/workflows/ios-unsigned.yml`. Push the source
to a private GitHub repository and run **build unsigned iOS package**. The
workflow uploads `ChatGPT-unsigned.ipa`, which can be re-signed with a personal
Apple ID using AltStore or Sideloadly. An unsigned IPA cannot be installed
directly; iOS always requires a valid signature and provisioning profile.
