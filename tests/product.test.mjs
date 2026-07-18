import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("renders the ChatGPT-style mobile shell", async () => {
  const [layout, page, shell, styles] = await Promise.all([
    readFile(new URL("app/layout.tsx", root), "utf8"),
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("shared/chat-shell.tsx", root), "utf8"),
    readFile(new URL("shared/chat-shell.css", root), "utf8"),
  ]);
  assert.match(layout, /title: "ChatGPT"/);
  assert.match(shell, /询问任何问题/);
  assert.match(shell, /aria-label="ChatGPT 模型选择"/);
  assert.match(shell, /<strong>ChatGPT<\/strong>/);
  assert.doesNotMatch(shell, /ChatGPT 5\.2|<span>5\.2<\/span>/);
  assert.match(shell, /有什么可以帮忙的？/);
  assert.match(shell, /className="message-actions"/);
  assert.match(shell, /mode === "secret" \? activateCover/);
  assert.match(shell, /activateEmergencyCover/);
  assert.match(shell, /placeholder="搜索对话"/);
  assert.match(shell, /showVoice/);
  assert.match(shell, /<textarea/);
  assert.match(styles, /\.me \.bubble/);
  assert.doesNotMatch(shell, /className="encryption-note"|<time>/);
  assert.doesNotMatch(`${layout}${page}${shell}`, /codex-preview|react-loading-skeleton/i);
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
  const [cryptoSource, apiSource, pageSource, shellSource] = await Promise.all([
    readFile(new URL("app/lib/chat-crypto.ts", root), "utf8"),
    readFile(new URL("app/api/messages/route.ts", root), "utf8"),
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("shared/chat-shell.tsx", root), "utf8"),
  ]);
  assert.match(cryptoSource, /AES-GCM/);
  assert.match(cryptoSource, /600_000/);
  assert.match(apiSource, /cipher_text/);
  assert.doesNotMatch(apiSource, /plaintext|message_text|\btext\b/);
  assert.match(shellSource, /holdTimer\.current = setTimeout\(\(\) => \{/);
  assert.match(shellSource, /\}, 900\);/);
  assert.doesNotMatch(pageSource, /text:\s*text|plaintext|messageText/);
});
