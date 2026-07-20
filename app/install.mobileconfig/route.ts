const profile = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>PayloadContent</key>
  <array>
    <dict>
      <key>FullScreen</key><true/>
      <key>IgnoreManifestScope</key><false/>
      <key>IsRemovable</key><true/>
      <key>Label</key><string>Hush</string>
      <key>PayloadDescription</key><string>安装 Hush Private Chat</string>
      <key>PayloadDisplayName</key><string>Hush</string>
      <key>PayloadIdentifier</key><string>com.hush.chat.webclip</string>
      <key>PayloadType</key><string>com.apple.webClip.managed</string>
      <key>PayloadUUID</key><string>9F997546-C8DA-4599-9C28-BE5EA646D407</string>
      <key>PayloadVersion</key><integer>1</integer>
      <key>Precomposed</key><true/>
      <key>URL</key><string>https://pmcoxiki.github.io/hush-private-chat/</string>
    </dict>
  </array>
  <key>PayloadDescription</key><string>在主屏幕安装 Hush Private Chat</string>
  <key>PayloadDisplayName</key><string>Hush</string>
  <key>PayloadIdentifier</key><string>com.hush.chat.profile</string>
  <key>PayloadOrganization</key><string>Hush Private Chat</string>
  <key>PayloadRemovalDisallowed</key><false/>
  <key>PayloadType</key><string>Configuration</string>
  <key>PayloadUUID</key><string>86EDC829-D1C2-49EF-B340-C42B9DC3B5DC</string>
  <key>PayloadVersion</key><integer>1</integer>
</dict>
</plist>`;

export async function GET() {
  return new Response(profile, {
    headers: {
      "content-type": "application/x-apple-aspen-config",
      "content-disposition": "attachment; filename=Hush.mobileconfig",
      "cache-control": "public, max-age=3600",
    },
  });
}
