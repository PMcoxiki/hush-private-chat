"use client";

import { FormEvent, PointerEvent, useEffect, useRef, useState } from "react";
import { decryptMessage, deriveRoom, encryptMessage, generateSharedSecret } from "./lib/chat-crypto";

type ChatMessage = { id: string; sender: "me" | "them"; text: string; time: string };
type ApiMessage = { id: string; senderId: string; cipherText: string; iv: string; createdAt: number };

export default function Home() {
  const [mode, setMode] = useState<"ai" | "secret">("ai");
  const [showGate, setShowGate] = useState(false);
  const [secret, setSecret] = useState("");
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [online, setOnline] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [aiMessages, setAiMessages] = useState<ChatMessage[]>([
    { id: "welcome", sender: "them", text: "你好！今天有什么我可以帮你的吗？", time: "现在" },
  ]);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const keyRef = useRef<CryptoKey | null>(null);
  const roomRef = useRef("");
  const senderRef = useRef("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    senderRef.current = localStorage.getItem("hush-device") || crypto.randomUUID();
    localStorage.setItem("hush-device", senderRef.current);
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => undefined);
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
            const clear = await decryptMessage(keyRef.current!, row.cipherText, row.iv);
            return {
              id: row.id,
              sender: row.senderId === senderRef.current ? "me" as const : "them" as const,
              text: clear,
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
    if (secret.trim().length < 16) { setError("为了安全，密钥至少需要 16 个字符"); return; }
    const derived = await deriveRoom(secret.trim());
    keyRef.current = derived.key;
    roomRef.current = derived.room;
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
    const encrypted = await encryptMessage(keyRef.current, text);
    await fetch("/api/messages", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
      room: roomRef.current, senderId: senderRef.current, cipherText: encrypted.cipherText, iv: encrypted.iv,
    }) });
    setMessages((items) => [...items, { id: crypto.randomUUID(), sender: "me", text, time: "现在" }]);
  };

  const activeMessages = mode === "ai" ? aiMessages : messages;

  return (
    <main className="app-shell">
      <section className="phone-app" aria-label="Hush 加密聊天">
        <header className="topbar">
          <button className="icon-button menu" aria-label="打开菜单"><span></span><span></span></button>
          <button className="identity" onPointerDown={beginHold} onPointerUp={cancelHold} onPointerCancel={cancelHold} onContextMenu={(e) => e.preventDefault()} aria-label="ChatGPT">
            <span><strong>ChatGPT <b>5.2</b></strong><small>{mode === "ai" ? "" : online ? "安全连接" : "连接中"}</small></span>
            <span className="model-chevron">⌄</span>
          </button>
          <button className="icon-button compose" aria-label="新对话">＋</button>
        </header>

        <div className={`conversation ${mode}`}>
          {mode === "secret" && <div className="day-label">今天</div>}
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
          <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="询问任何问题" aria-label="消息" />
          <button className="send" aria-label="发送消息" disabled={!draft.trim()}>↑</button>
        </form>
        <div className="home-indicator"></div>
      </section>

      {showGate && <div className="gate-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setShowGate(false); }}>
        <form className="gate" onSubmit={unlock}>
          <div className="lock-mark">⌁</div>
          <h2>模型诊断</h2>
          <p>输入诊断访问令牌</p>
          <input autoFocus type="password" value={secret} onChange={(e) => setSecret(e.target.value)} placeholder="访问密钥" autoComplete="off" />
          <button type="button" className="generate" onClick={() => setSecret(generateSharedSecret())}>生成高强度密钥</button>
          {error && <div className="gate-error">{error}</div>}
          <button type="submit">进入对话</button>
          <button type="button" className="cancel" onClick={() => setShowGate(false)}>取消</button>
        </form>
      </div>}
    </main>
  );
}
