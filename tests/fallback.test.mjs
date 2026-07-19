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
  COVER_HISTORY_KEY,
  COVER_MESSAGE_COUNT,
  createCoverMessages,
  generateCoverReply,
  groupPrivateMessages,
  normalizeCoverHistory,
  selectEmergencyCover,
  serializeCoverHistory,
} from "../shared/cover-chat.ts";
import { settleSessionOperation } from "../shared/private-session.ts";
import {
  mergePrivateQuickReply,
  PRIVATE_QUICK_REPLIES,
} from "../shared/private-quick-replies.ts";
import { generatePrivateAiReply } from "../shared/private-ai-replies.ts";

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
  const [app, shell, transport, manifest, workflow] = await Promise.all([
    readFile(new URL("fallback/src/App.tsx", root), "utf8"),
    readFile(new URL("shared/chat-shell.tsx", root), "utf8"),
    readFile(new URL("fallback/src/mqtt-room.ts", root), "utf8"),
    readFile(new URL("public/manifest.webmanifest", root), "utf8"),
    readFile(new URL(".github/workflows/pages.yml", root), "utf8"),
  ]);
  assert.match(app, /ChatShell/);
  assert.match(shell, /aria-label="ChatGPT 模型选择"/);
  assert.match(shell, /<strong>ChatGPT<\/strong>/);
  assert.match(shell, /className="welcome-state"/);
  assert.match(shell, /className="message-actions"/);
  assert.match(shell, /placeholder="搜索对话"/);
  assert.match(shell, /attachment-options/);
  assert.match(shell, /voice-mode/);
  assert.match(shell, /<textarea/);
  assert.doesNotMatch(shell, /className="encryption-note"|<time>|ChatGPT 5\.2/);
  assert.match(shell, /setTimeout\(\(\) => \{/);
  assert.doesNotMatch(`${app}${shell}`, /\/api\/messages|OpenAI|ChatGPT.*login/i);
  assert.match(transport, /retain: true/);
  assert.match(transport, /broker\.emqx\.io/);
  assert.match(transport, /broker\.hivemq\.com/);
  assert.equal(JSON.parse(manifest).start_url, ".");
  assert.match(workflow, /deploy-pages@v4/);
});

test("lifecycle cover clears the private room and creates a convincing local AI conversation", async () => {
  const app = await readFile(new URL("shared/chat-shell.tsx", root), "utf8");
  const messages = createCoverMessages(1_788_000_000_000);

  assert.equal(COVER_MESSAGE_COUNT, 10);
  assert.equal(messages.length, COVER_MESSAGE_COUNT);
  assert.deepEqual(messages.map((message) => message.sender), [
    "me", "them", "me", "them", "me", "them", "me", "them", "me", "them",
  ]);
  assert.ok(messages.every((message, index) => index === 0 || message.createdAt > messages[index - 1].createdAt));
  assert.match(app, /const handleMenu = \(\) => \{\s*setShowSidebar\(true\);\s*\};/);
  assert.match(app, /clearPrivateState\(\);\s*activateEmergencyCover\(\);/);
  assert.match(app, /activateEmergencyCover\(\)/);
  assert.match(app, /roomSession !== roomSessionRef\.current/);
  assert.match(app, /roomSessionRef\.current \+= 1;/);
  assert.doesNotMatch(app, /transportRef\.current\.send\([^)]*cover/i);
});

test("active room stays reachable and every private message gets one local AI reply", async () => {
  const [shell, repliesSource] = await Promise.all([
    readFile(new URL("shared/chat-shell.tsx", root), "utf8"),
    readFile(new URL("shared/private-ai-replies.ts", root), "utf8"),
  ]);
  const prompts = [
    "今天下午三点前完成",
    "不要改写原来的意思",
    "帮我列一个简单清单",
    "为什么会出现这个问题？",
    "我已经把第一部分处理好了",
    "明天怎么安排比较合适？",
  ];
  const replies = prompts.map(generatePrivateAiReply);
  const menuHandler = shell.slice(shell.indexOf("const handleMenu"), shell.indexOf("const returnToPrivateRoom"));
  const roomNavigation = shell.slice(shell.indexOf("const returnToPrivateRoom"), shell.indexOf("const handleComposerTool"));

  assert.ok(replies.every((reply) => reply.length >= 40));
  assert.ok(new Set(replies).size >= 5);
  assert.equal(generatePrivateAiReply(prompts[0]), replies[0]);
  assert.doesNotMatch(repliesSource, /fetch|XMLHttpRequest|OpenAI|GPT/i);
  assert.match(shell, /const \[roomAvailable, setRoomAvailable\] = useState\(false\)/);
  assert.match(shell, /aria-label="返回当前房间"/);
  assert.match(shell, /继续当前对话/);
  assert.match(shell, /const returnToPrivateRoom/);
  assert.doesNotMatch(`${menuHandler}${roomNavigation}`, /clearPrivateState|transportRef\.current\?\.close|activateEmergencyCover/);
  assert.match(roomNavigation, /setMode\("secret"\)/);
  assert.match(roomNavigation, /setMode\("ai"\)/);
  assert.match(shell, /new Map\(messages\.map\(\(message\) => \[message\.id, generatePrivateAiReply\(message\.text\)\]\)\)/);
  assert.match(shell, /turn\.messageIds\.map\(\(messageId\) => privateAiReplies\.get\(messageId\)/);
  assert.doesNotMatch(shell.slice(shell.indexOf("const send = async"), shell.indexOf("const handleComposerKeyDown")), /generatePrivateAiReply|privateAiReplies/);
});

test("private composer plus offers AI-like replies without leaving the room", async () => {
  const shell = await readFile(new URL("shared/chat-shell.tsx", root), "utf8");
  const toolStart = shell.indexOf("const handleComposerTool");
  const toolEnd = shell.indexOf("const choosePrivateQuickReply");
  const replyEnd = shell.indexOf("const makeSecret");
  const toolHandler = shell.slice(toolStart, toolEnd);
  const replyHandler = shell.slice(toolEnd, replyEnd);

  assert.equal(PRIVATE_QUICK_REPLIES.length, 8);
  assert.equal(new Set(PRIVATE_QUICK_REPLIES).size, PRIVATE_QUICK_REPLIES.length);
  assert.ok(PRIVATE_QUICK_REPLIES.every((reply) => reply.length >= 20));
  assert.equal(mergePrivateQuickReply("", PRIVATE_QUICK_REPLIES[0]), PRIVATE_QUICK_REPLIES[0]);
  assert.equal(
    mergePrivateQuickReply("已有内容", PRIVATE_QUICK_REPLIES[1]),
    `已有内容\n\n${PRIVATE_QUICK_REPLIES[1]}`,
  );
  assert.ok(toolStart > 0 && toolEnd > toolStart && replyEnd > toolEnd);
  assert.match(toolHandler, /mode === "secret"[\s\S]*setShowQuickReplies\(true\)/);
  assert.doesNotMatch(toolHandler, /activateCover|clearPrivateState|transportRef|\.close\(/);
  assert.match(replyHandler, /mergePrivateQuickReply/);
  assert.doesNotMatch(replyHandler, /transportRef|\.send\(|\.close\(/);
  assert.match(shell, /aria-label="建议回复"/);
  assert.match(shell, /点选后会填入输入框，可编辑后发送/);
});

test("local cover engine recognizes varied consultation intents without network access", () => {
  const prompts = [
    ["帮我规划三天的复习安排", "plan"],
    ["如何开始整理家里的书？", "plan"],
    ["润色这封会议邀请邮件", "rewrite"],
    ["把这句话换个更自然的说法", "rewrite"],
    ["翻译成英文：会议推迟到明天", "translate"],
    ["How would you translate this into Chinese?", "translate"],
    ["总结这份项目复盘的要点", "summarize"],
    ["Please summarize the following notes", "summarize"],
    ["解释一下机会成本是什么", "explain"],
    ["为什么天空看起来是蓝色的？", "explain"],
    ["列一个出差前检查清单", "checklist"],
    ["Give me a checklist for moving house", "checklist"],
    ["比较纸质书和电子书的优缺点", "compare"],
    ["React vs Vue 有哪些差异？", "compare"],
    ["给周末活动想几个创意", "brainstorm"],
    ["Brainstorm ideas for a small team event", "brainstorm"],
    ["这段代码报错了", "follow-up"],
    ["我最近效率不高", "follow-up"],
    ["准备一场面试要怎么做", "plan"],
    ["把下面内容提炼成三句话", "summarize"],
  ];

  const replies = prompts.map(([prompt, intent]) => {
    const result = generateCoverReply(prompt);
    assert.equal(result.intent, intent, prompt);
    assert.ok(result.title.length > 3, prompt);
    assert.ok(result.text.length > 45, prompt);
    assert.ok(result.thinkingMs >= 420, prompt);
    assert.ok(result.streamIntervalMs >= 24, prompt);
    return result.text;
  });

  assert.ok(new Set(replies).size >= 18);
  assert.doesNotMatch(generateCoverReply.toString(), /fetch|XMLHttpRequest|OpenAI|GPT/i);
});

test("cover history is versioned, capped, and selected without private state", () => {
  const now = 1_788_000_000_000;
  const generated = Array.from({ length: 15 }, (_, index) => ({
    ...selectEmergencyCover([], now - index * 1_000, index),
    id: `cover-${index}`,
  }));
  const parsed = normalizeCoverHistory(JSON.parse(serializeCoverHistory(generated)));

  assert.equal(COVER_HISTORY_KEY, "local-consultations-v2");
  assert.equal(parsed.length, 12);
  assert.ok(parsed.every((conversation) => conversation.messages.length >= 8));
  assert.equal(selectEmergencyCover(parsed, now + 1_000).id, parsed[0].id);
  assert.deepEqual(normalizeCoverHistory({ version: 1, conversations: generated }), []);
});

test("private presentation groups cadence while preserving every original segment", () => {
  const original = [
    { id: "1", senderId: "me", text: "第一个问题", createdAt: 1 },
    { id: "2", senderId: "me", text: "补充条件：不要改写", createdAt: 2 },
    { id: "3", senderId: "peer", text: "第一段原文", createdAt: 3 },
    { id: "4", senderId: "peer", text: "- 第二段\n```ts\nconst exact = true;\n```", createdAt: 4 },
    { id: "5", senderId: "me", text: "收到", createdAt: 5 },
  ];
  const turns = groupPrivateMessages(original, "me");

  assert.equal(turns.length, 3);
  assert.deepEqual(turns.map((turn) => turn.role), ["user", "assistant", "user"]);
  assert.deepEqual(turns.flatMap((turn) => turn.segments), original.map((message) => message.text));
  assert.match(turns[1].text, /const exact = true/);
  assert.ok(turns[1].messageIds.includes("4"));
});

test("stale private operations cannot revive plaintext after a lock", async () => {
  let currentSession = 7;
  let resolveSend;
  const pendingSend = new Promise((resolve) => { resolveSend = resolve; });
  const sendResult = settleSessionOperation(pendingSend, currentSession, () => currentSession);

  currentSession += 1;
  resolveSend({ text: "must not return to the cover" });
  assert.deepEqual(await sendResult, {
    status: "fulfilled",
    value: { text: "must not return to the cover" },
    current: false,
  });

  let rejectUnlock;
  const pendingUnlock = new Promise((resolve, reject) => { rejectUnlock = reject; });
  const unlockResult = settleSessionOperation(pendingUnlock, currentSession, () => currentSession);
  currentSession += 1;
  rejectUnlock(new Error("late room failure"));
  const settledUnlock = await unlockResult;
  assert.equal(settledUnlock.status, "rejected");
  assert.equal(settledUnlock.current, false);
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

test("defaults every release surface to dark mode while retaining a local light option", async () => {
  const [layout, fallbackPage, manifestSource, styles, shell, nativeApp, webView, launchColor] = await Promise.all([
    readFile(new URL("app/layout.tsx", root), "utf8"),
    readFile(new URL("fallback/index.html", root), "utf8"),
    readFile(new URL("public/manifest.webmanifest", root), "utf8"),
    readFile(new URL("shared/chat-shell.css", root), "utf8"),
    readFile(new URL("shared/chat-shell.tsx", root), "utf8"),
    readFile(new URL("ios/Hush/HushApp.swift", root), "utf8"),
    readFile(new URL("ios/Hush/ChatWebView.swift", root), "utf8"),
    readFile(new URL("ios/Hush/Assets.xcassets/LaunchBackground.colorset/Contents.json", root), "utf8"),
  ]);
  const manifest = JSON.parse(manifestSource);
  const launch = JSON.parse(launchColor);

  assert.match(layout, /data-theme="dark"/);
  assert.match(layout, /chatgpt-cover-theme-v1/);
  assert.match(fallbackPage, /theme-color" content="#212121"/);
  assert.match(fallbackPage, /black-translucent/);
  assert.equal(manifest.background_color, "#212121");
  assert.equal(manifest.theme_color, "#212121");
  assert.match(styles, /:root \{[\s\S]*color-scheme: dark;/);
  assert.match(styles, /html\[data-theme="light"\]/);
  assert.match(shell, /const THEME_STORAGE_KEY = "chatgpt-cover-theme-v1"/);
  assert.match(shell, /aria-pressed=\{theme === "dark"\}/);
  assert.match(nativeApp, /preferredColorScheme\(\.dark\)/);
  assert.match(webView, /UIColor\(red: 33\.0 \/ 255\.0, green: 33\.0 \/ 255\.0, blue: 33\.0 \/ 255\.0/);
  assert.equal(launch.colors[0].color.components.red, "0.129");
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
  assert.match(nativeApp, /URL\(string: "hush:\/\/app\/index\.html"\)/);
  assert.match(nativeApp, /ChatWebView\(/);
  assert.match(webView, /setURLSchemeHandler\(context\.coordinator, forURLScheme: "hush"\)/);
  assert.match(webView, /WKURLSchemeHandler/);
  assert.match(webView, /webView\.load\(URLRequest\(url: AppConfiguration\.appURL\)\)/);
  assert.match(webView, /requestedPath\.hasPrefix\(rootPath \+ "\/"\)/);
  assert.match(webView, /case "js": "text\/javascript"/);
  assert.match(webView, /case "css": "text\/css"/);
  assert.match(project, /WebApp in Resources/);
  assert.doesNotMatch(webView, /loadFileURL|allowFileAccessFromFileURLs/);
  assert.doesNotMatch(`${nativeApp}${webView}`, /URL\(string:\s*"https?:|pmcoxiki\.github\.io|hush-private-ai/);
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

test("backgrounding synchronously covers and locks private presentation on web and iOS", async () => {
  const [shell, sitesRoom, styles, serviceWorker, nativeApp, webView, security] = await Promise.all([
    readFile(new URL("shared/chat-shell.tsx", root), "utf8"),
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("shared/chat-shell.css", root), "utf8"),
    readFile(new URL("public/sw.js", root), "utf8"),
    readFile(new URL("ios/Hush/HushApp.swift", root), "utf8"),
    readFile(new URL("ios/Hush/ChatWebView.swift", root), "utf8"),
    readFile(new URL("SECURITY.md", root), "utf8"),
  ]);

  assert.match(shell, /document\.documentElement\.dataset\.privateLocked = "true"/);
  assert.match(shell, /visibilitychange/);
  assert.match(shell, /pagehide/);
  assert.match(shell, /app-inactive/);
  assert.doesNotMatch(shell, /if \(mode !== "secret"\) return;/);
  assert.match(shell, /useEffectEvent/);
  assert.match(shell, /lockPrivateForLifecycle/);
  assert.match(shell, /\}, \[\]\);/);
  assert.match(shell, /clearPrivateState\(\);[\s\S]*activateEmergencyCover\(\)/);
  assert.match(shell, /settleSessionOperation\([\s\S]*activeTransport\.send\(text\)/);
  assert.match(shell, /if \(!result\.current\) return;/);
  assert.match(shell, /speechSynthesis\.cancel\(\)/);
  assert.match(sitesRoom, /new Set<AbortController>/);
  assert.match(sitesRoom, /controller\.abort\(\)/);
  assert.match(styles, /html\[data-private-locked="true"\] \.privacy-shield/);
  assert.match(serviceWorker, /chat-shell-v4/);
  assert.match(nativeApp, /scenePhase/);
  assert.match(nativeApp, /privacyCoverVisible = true/);
  assert.match(nativeApp, /if newPhase != \.active \{\s*privacyCoverVisible = true/);
  assert.match(nativeApp, /PrivacyCoverView/);
  assert.match(nativeApp, /onPrivacyReady/);
  assert.doesNotMatch(nativeApp, /asyncAfter/);
  assert.match(webView, /app-active/);
  assert.match(webView, /app-inactive/);
  assert.match(webView, /WKScriptMessageHandler/);
  assert.match(webView, /privacyReady/);
  assert.match(webView, /readinessScript/);
  assert.match(webView, /main\.app-shell \.composer textarea/);
  assert.match(webView, /dataset\.privateLocked === 'true'/);
  assert.match(webView, /attempt < 50/);
  assert.match(security, /casual inspection/);
  assert.match(security, /cannot prevent a user from taking a screenshot/);
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
