"use client";

import { FormEvent, PointerEvent, useEffect, useRef, useState } from "react";

type ChatMessage = { id: string; sender: "me" | "them"; text: string; time: string };
type ApiMessage = { id: string; senderId: string; cipherText: string; iv: string; createdAt: number };

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function bytesToBase64(bytes: Uint8Array) {
  let value = "";
  bytes.forEach((byte) => (value += String.fromCharCode(byte)));
  return btoa(value);
}

function base64ToBytes(value: string) {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}

async function hash(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function makeKey(secret: string) {
  const source = await crypto.subtle.importKey("raw", encoder.encode(secret), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: encoder.encode("hush-room-v1"), iterations: 210000, hash: "SHA-256" },
    source,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export default function Home() {
  const [mode, setMode] = useState<"ai" | "secret">("ai");
  const [showGate, setShowGate] = useState(false);
  const [secret, setSecret] = useState("");
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [online, setOnline] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [aiMessages, setAiMessages] = useState<ChatMessage[]>([
    { id: "welcome", sender: "them", text: "你好，我是你的私人 AI 顾问。今天想聊点什么？", time: "现在" },
  ]);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const keyRef = useRef<CryptoKey | null>(null);
  const roomRef = useRef("");
  const senderRef = useRef("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    senderRef.current = localStorage.getItem("hush-device") || crypto.randomUUID();
    localStorage.setItem("hush-device", senderRef.current);
  }, []);

  useEffect(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), [messages, aiMessages]);

  useEffect(() => {
    if (mode !== "secret") return;
    let active = true;
    const sync = async () => {
      try {
        const response = await fetch(`/api/messages?room=${roomRef.current}`, { cache: "no-store" });
        if (!response.ok || !active || !keyRef.current) return;
        const rows = (await response.json()) as ApiMessage[];
        const decoded = await Promise.all(rows.map(async (row) => {
          try {
            const clear = await crypto.subtle.decrypt(
              { name: "AES-GCM", iv: base64ToBytes(row.iv) },
              keyRef.current!,
              base64ToBytes(row.cipherText),
            );
            return {
              id: row.id,
              sender: row.senderId === senderRef.current ? "me" as const : "them" as const,
              text: decoder.decode(clear),
              time: new Date(row.createdAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }),
            };
          } catch { return null; }
        }));
        if (active) { setMessages(decoded.filter(Boolean) as ChatMessage[]); setOnline(true); }
      } catch { if (active) setOnline(false); }
    };
    sync();
    const timer = setInterval(sync, 2500);
    return () => { active = false; clearInterval(timer); };
  }, [mode]);

  const beginHold = (event: PointerEvent) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    holdTimer.current = setTimeout(() => { setShowGate(true); navigator.vibrate?.(20); }, 900);
  };

  const cancelHold = () => { if (holdTimer.current) clearTimeout(holdTimer.current); };

  const unlock = async (event: FormEvent) => {
    event.preventDefault();
    if (secret.trim().length < 6) { setError("密钥至少需要 6 个字符"); return; }
    keyRef.current = await makeKey(secret.trim());
    roomRef.current = (await hash(`room:${secret.trim()}`)).slice(0, 32);
    setMessages([]); setMode("secret"); setShowGate(false); setSecret(""); setError("");
  };

  const send = async (event: FormEvent) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    if (mode === "ai") {
      setAiMessages((items) => [...items, { id: crypto.randomUUID(), sender: "me", text, time: "现在" }]);
      setTimeout(() => setAiMessages((items) => [...items, {
        id: crypto.randomUUID(), sender: "them", text: "我在听。你可以继续说说具体情况，我会帮你梳理思路。", time: "现在",
      }]), 650);
      return;
    }
    if (!keyRef.current) return;
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, keyRef.current, encoder.encode(text));
    await fetch("/api/messages", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
      room: roomRef.current, senderId: senderRef.current, cipherText: bytesToBase64(new Uint8Array(cipher)), iv: bytesToBase64(iv),
    }) });
    setMessages((items) => [...items, { id: crypto.randomUUID(), sender: "me", text, time: "现在" }]);
  };

  const activeMessages = mode === "ai" ? aiMessages : messages;

  return (
    <main className="app-shell">
      <section className="phone-app" aria-label="Hush 加密聊天">
        <header className="topbar">
          <button className="icon-button menu" aria-label="打开菜单"><span></span><span></span></button>
          <button className="identity" onPointerDown={beginHold} onPointerUp={cancelHold} onPointerCancel={cancelHold} onContextMenu={(e) => e.preventDefault()} aria-label="私人 AI 顾问">
            <span className={`status-dot ${mode === "secret" ? "secure" : ""}`}></span>
            <span><strong>{mode === "ai" ? "私人 AI 顾问" : "私人 AI 顾问"}</strong><small>{mode === "ai" ? "在线" : online ? "端到端加密 · 在线" : "端到端加密 · 连接中"}</small></span>
          </button>
          <button className="icon-button compose" aria-label="新对话">＋</button>
        </header>

        <div className="conversation">
          <div className="day-label">今天</div>
          {mode === "secret" && <div className="encryption-note"><span>✓</span> 消息已在此设备加密，服务器无法读取</div>}
          {activeMessages.map((message) => (
            <div className={`message-row ${message.sender}`} key={message.id}>
              {message.sender === "them" && <div className={`avatar ${mode === "secret" ? "muted-avatar" : ""}`}>{mode === "ai" ? "✦" : "A"}</div>}
              <div><div className="bubble">{message.text}</div><time>{message.time}{message.sender === "me" ? "  ✓✓" : ""}</time></div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        <form className="composer" onSubmit={send}>
          <button type="button" className="attach" aria-label="添加附件">＋</button>
          <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={mode === "ai" ? "给私人 AI 顾问发消息" : "输入消息"} aria-label="消息" />
          <button className="send" aria-label="发送消息" disabled={!draft.trim()}>↑</button>
        </form>
        <div className="home-indicator"></div>
      </section>

      {showGate && <div className="gate-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setShowGate(false); }}>
        <form className="gate" onSubmit={unlock}>
          <div className="lock-mark">⌁</div>
          <h2>连接私人频道</h2>
          <p>输入你们约定的访问密钥</p>
          <input autoFocus type="password" value={secret} onChange={(e) => setSecret(e.target.value)} placeholder="访问密钥" autoComplete="off" />
          {error && <div className="gate-error">{error}</div>}
          <button type="submit">进入对话</button>
          <button type="button" className="cancel" onClick={() => setShowGate(false)}>取消</button>
        </form>
      </div>}
    </main>
  );
}
