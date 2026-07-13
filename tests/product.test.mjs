import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("renders the ChatGPT-style mobile shell", async () => {
  const [layout, page, styles] = await Promise.all([
    readFile(new URL("app/layout.tsx", root), "utf8"),
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/globals.css", root), "utf8"),
  ]);
  assert.match(layout, /title: "ChatGPT"/);
  assert.match(page, /询问任何问题/);
  assert.match(page, /ChatGPT <b>5\.2<\/b>/);
  assert.match(styles, /\.me \.bubble/);
  assert.doesNotMatch(`${layout}${page}`, /codex-preview|react-loading-skeleton/i);
});

test("ships an installable PWA manifest and iOS profile", async () => {
  const [manifest, route] = await Promise.all([
    readFile(new URL("public/manifest.webmanifest", root), "utf8"),
    readFile(new URL("app/install.mobileconfig/route.ts", root), "utf8"),
  ]);
  const parsed = JSON.parse(manifest);
  assert.equal(parsed.display, "standalone");
  assert.equal(parsed.name, "ChatGPT");
  assert.match(route, /application\/x-apple-aspen-config/);
  assert.match(route, /com\.apple\.webClip\.managed/);
});

test("keeps plaintext crypto operations on the client", async () => {
  const [cryptoSource, apiSource, pageSource] = await Promise.all([
    readFile(new URL("app/lib/chat-crypto.ts", root), "utf8"),
    readFile(new URL("app/api/messages/route.ts", root), "utf8"),
    readFile(new URL("app/page.tsx", root), "utf8"),
  ]);
  assert.match(cryptoSource, /AES-GCM/);
  assert.match(cryptoSource, /600_000/);
  assert.match(apiSource, /cipher_text/);
  assert.doesNotMatch(apiSource, /plaintext|message_text|\btext\b/);
  assert.match(pageSource, /setTimeout\(\(\) => \{ setShowGate\(true\)/);
});
