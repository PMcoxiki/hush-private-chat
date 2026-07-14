import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  decryptPayload,
  deriveRoom,
  encryptPayload,
} from "../fallback/src/chat-crypto.ts";

const root = new URL("../", import.meta.url);

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

test("all iPhone install surfaces target the configured fallback deployment", async () => {
  const deploymentUrl = "https://pmcoxiki.github.io/hush-private-chat/";
  const [nativeApp, nativePolicy, profileRoute, profile, instructions] = await Promise.all([
    readFile(new URL("ios/Hush/HushApp.swift", root), "utf8"),
    readFile(new URL("ios/Hush/Info.plist", root), "utf8"),
    readFile(new URL("app/install.mobileconfig/route.ts", root), "utf8"),
    readFile(new URL("distribution/ChatGPT.mobileconfig", root), "utf8"),
    readFile(new URL("distribution/安装与使用说明.md", root), "utf8"),
  ]);

  assert.match(nativeApp, new RegExp(deploymentUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(nativePolicy, /<string>pmcoxiki\.github\.io<\/string>/);
  assert.match(profileRoute, new RegExp(deploymentUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(profile, new RegExp(deploymentUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(instructions, new RegExp(deploymentUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.doesNotMatch(`${nativeApp}${nativePolicy}${profileRoute}${profile}${instructions}`, /hush-private-ai\.coxiki\.chatgpt\.site/);
});

test("release packaging refuses an unavailable iPhone target", async () => {
  const [packageScript, targetCheck, relayCheck] = await Promise.all([
    readFile(new URL("scripts/package-release.sh", root), "utf8"),
    readFile(new URL("scripts/verify-install-target.mjs", root), "utf8"),
    readFile(new URL("scripts/verify-retained-relay.mjs", root), "utf8"),
  ]);

  assert.match(packageScript, /npm run verify:install-target/);
  assert.match(targetCheck, /pageResponse\.ok/);
  assert.match(targetCheck, /manifest\.display !== "standalone"/);
  assert.match(relayCheck, /retainedHistory: true/);
  assert.match(relayCheck, /plaintextInEnvelope: false/);
});
