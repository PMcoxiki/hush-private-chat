import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  decryptPayload,
  deriveRoom,
  encryptPayload,
} from "../fallback/src/chat-crypto.ts";
import {
  COVER_MESSAGE_COUNT,
  createCoverMessages,
} from "../shared/cover-chat.ts";

const root = new URL("../", import.meta.url);
const rootPath = fileURLToPath(root);

async function listFiles(directory, prefix = "") {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relative = join(prefix, entry.name);
    if (entry.isDirectory()) files.push(...await listFiles(join(directory, entry.name), relative));
    else files.push(relative);
  }
  return files.sort();
}

test("fallback derives stable rooms and round-trips encrypted payloads", async () => {
  const first = await deriveRoom("correct horse battery staple 2026");
  const second = await deriveRoom("correct horse battery staple 2026");
  assert.equal(first.room, second.room);

  const clear = {
    senderId: "device-test",
    text: "private fallback message",
    createdAt: 1_788_000_000_000,
  };
  const envelope = await encryptPayload(first.key, clear);
  assert.doesNotMatch(JSON.stringify(envelope), /private fallback message|device-test/);
  assert.deepEqual(await decryptPayload(second.key, envelope), clear);
});

test("fallback uses retained ciphertext transport without the Sites API", async () => {
  const [app, transport, manifest, workflow] = await Promise.all([
    readFile(new URL("fallback/src/App.tsx", root), "utf8"),
    readFile(new URL("fallback/src/mqtt-room.ts", root), "utf8"),
    readFile(new URL("public/manifest.webmanifest", root), "utf8"),
    readFile(new URL(".github/workflows/pages.yml", root), "utf8"),
  ]);
  assert.match(app, /aria-label="ChatGPT 5\.2"/);
  assert.match(app, /<strong>ChatGPT <span>5\.2<\/span><\/strong>/);
  assert.match(app, /className="welcome-state"/);
  assert.match(app, /className="message-actions"/);
  assert.match(app, /<textarea/);
  assert.doesNotMatch(app, /className="encryption-note"|<time>/);
  assert.match(app, /setTimeout\(\(\) => \{/);
  assert.doesNotMatch(app, /\/api\/messages|OpenAI|ChatGPT.*login/i);
  assert.match(transport, /retain: true/);
  assert.match(transport, /broker\.emqx\.io/);
  assert.match(transport, /broker\.hivemq\.com/);
  assert.equal(JSON.parse(manifest).start_url, ".");
  assert.match(workflow, /deploy-pages@v4/);
});

test("emergency cover creates a convincing local AI conversation", async () => {
  const app = await readFile(new URL("fallback/src/App.tsx", root), "utf8");
  const messages = createCoverMessages(1_788_000_000_000);

  assert.equal(COVER_MESSAGE_COUNT, 10);
  assert.equal(messages.length, COVER_MESSAGE_COUNT);
  assert.deepEqual(messages.map((message) => message.sender), [
    "me", "them", "me", "them", "me", "them", "me", "them", "me", "them",
  ]);
  assert.ok(messages.every((message, index) => index === 0 || message.createdAt > messages[index - 1].createdAt));
  assert.match(app, /mode === "secret" \? activateCover/);
  assert.match(app, /setAiMessages\(createCoverMessages\(\)\.map/);
  assert.match(app, /roomSession !== roomSessionRef\.current/);
  assert.match(app, /roomSessionRef\.current \+= 1;/);
  assert.doesNotMatch(app, /transportRef\.current\.send\([^)]*cover/i);
});

test("all iPhone install surfaces target the configured fallback deployment", async () => {
  const deploymentUrl = "https://pmcoxiki.github.io/hush-private-chat/";
  const [profileRoute, profile, instructions] = await Promise.all([
    readFile(new URL("app/install.mobileconfig/route.ts", root), "utf8"),
    readFile(new URL("distribution/ChatGPT.mobileconfig", root), "utf8"),
    readFile(new URL("distribution/安装与使用说明.md", root), "utf8"),
  ]);

  assert.match(profileRoute, new RegExp(deploymentUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(profile, new RegExp(deploymentUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(instructions, new RegExp(deploymentUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.doesNotMatch(`${profileRoute}${profile}${instructions}`, /hush-private-ai\.coxiki\.chatgpt\.site/);
});

test("native wrapper embeds the current fallback instead of loading a hosted page", async () => {
  const [nativeApp, webView, nativePolicy, project, builtFiles, embeddedFiles] = await Promise.all([
    readFile(new URL("ios/Hush/HushApp.swift", root), "utf8"),
    readFile(new URL("ios/Hush/ChatWebView.swift", root), "utf8"),
    readFile(new URL("ios/Hush/Info.plist", root), "utf8"),
    readFile(new URL("ios/Hush.xcodeproj/project.pbxproj", root), "utf8"),
    listFiles(join(rootPath, "outputs/github-pages")),
    listFiles(join(rootPath, "ios/Hush/WebApp")),
  ]);

  assert.match(nativeApp, /appendingPathComponent\("WebApp", isDirectory: true\)/);
  assert.match(nativeApp, /ChatWebView\(\)/);
  assert.match(webView, /loadFileURL/);
  assert.match(webView, /allowingReadAccessTo: AppConfiguration\.webRootURL/);
  assert.match(project, /WebApp in Resources/);
  assert.doesNotMatch(`${nativeApp}${webView}`, /URL\(string:|pmcoxiki\.github\.io|hush-private-ai/);
  assert.doesNotMatch(nativePolicy, /pmcoxiki\.github\.io|WKAppBoundDomains/);
  assert.deepEqual(embeddedFiles, builtFiles);

  for (const relative of builtFiles) {
    const [built, embedded] = await Promise.all([
      readFile(join(rootPath, "outputs/github-pages", relative)),
      readFile(join(rootPath, "ios/Hush/WebApp", relative)),
    ]);
    assert.deepEqual(embedded, built, `stale embedded iOS asset: ${relative}`);
  }
});

test("release packaging refuses an unavailable iPhone target", async () => {
  const [packageScript, iosPackageScript, targetCheck, relayCheck] = await Promise.all([
    readFile(new URL("scripts/package-release.sh", root), "utf8"),
    readFile(new URL("scripts/package-ios-source.sh", root), "utf8"),
    readFile(new URL("scripts/verify-install-target.mjs", root), "utf8"),
    readFile(new URL("scripts/verify-retained-relay.mjs", root), "utf8"),
  ]);

  assert.match(packageScript, /npm run verify:install-target/);
  assert.match(packageScript, /scripts\/package-ios-source\.sh/);
  assert.match(iosPackageScript, /outputs\/github-pages/);
  assert.match(iosPackageScript, /unzip -tq outputs\/Hush-iOS-source\.zip/);
  assert.match(targetCheck, /pageResponse\.ok/);
  assert.match(targetCheck, /manifest\.display !== "standalone"/);
  assert.match(relayCheck, /retainedHistory: true/);
  assert.match(relayCheck, /plaintextInEnvelope: false/);
});
