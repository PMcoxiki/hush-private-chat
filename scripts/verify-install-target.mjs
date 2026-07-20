import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const profile = await readFile(new URL("distribution/ChatGPT.mobileconfig", root), "utf8");
const targetMatch = profile.match(/<key>URL<\/key>\s*<string>(https:\/\/[^<]+)<\/string>/);

if (!targetMatch) {
  throw new Error("The iPhone profile does not contain an HTTPS install target");
}

const target = new URL(targetMatch[1]);
const requestOptions = {
  headers: {
    "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1",
  },
  redirect: "follow",
  signal: AbortSignal.timeout(15_000),
};

const pageResponse = await fetch(target, requestOptions);
if (!pageResponse.ok) {
  throw new Error(`Install target returned HTTP ${pageResponse.status}: ${target}`);
}

const page = await pageResponse.text();
if (!/<div[^>]+id=["']root["']/i.test(page)) {
  throw new Error(`Install target does not contain the fallback application root: ${target}`);
}

const manifestUrl = new URL("manifest.webmanifest", target);
const manifestResponse = await fetch(manifestUrl, requestOptions);
if (!manifestResponse.ok) {
  throw new Error(`PWA manifest returned HTTP ${manifestResponse.status}: ${manifestUrl}`);
}

const manifest = await manifestResponse.json();
if (manifest.name !== "Hush Private Chat" || manifest.display !== "standalone") {
  throw new Error("PWA manifest is not the expected standalone Hush cover");
}

console.log(JSON.stringify({
  target: target.href,
  pageStatus: pageResponse.status,
  manifestStatus: manifestResponse.status,
  standalone: true,
}));
