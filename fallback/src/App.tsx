import {
  type FormEvent,
  type PointerEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { deriveRoom, generateSharedSecret } from "./chat-crypto";
import type {
  ConnectionStatus,
  RoomMessage,
  RoomTransport,
} from "./mqtt-room";

type Mode = "ai" | "secret";
type UiMessage = RoomMessage & { sender: "me" | "them" };

const initialAiMessages: UiMessage[] = [{
  id: "welcome",
  senderId: "assistant",
  sender: "them",
  text: "你好！今天有什么我可以帮你的吗？",
  createdAt: Date.now(),
}];

function mergeMessage(items: UiMessage[], message: UiMessage) {
  const next = items.some((item) => item.id === message.id)
    ? items.map((item) => (item.id === message.id ? message : item))
    : [...items, message];
  return next.sort((a, b) => a.createdAt - b.createdAt);
}

function displayTime(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function App() {
  const [mode, setMode] = useState<Mode>("ai");
  const [showGate, setShowGate] = useState(false);
  const [secret, setSecret] = useState("");
  const [revealSecret, setRevealSecret] = useState(false);
  const [gateBusy, setGateBusy] = useState(false);
  const [gateError, setGateError] = useState("");
  const [draft, setDraft] = useState("");
  const [notice, setNotice] = useState("");
  const [status, setStatus] = useState<ConnectionStatus>("offline");
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [aiMessages, setAiMessages] = useState<UiMessage[]>(initialAiMessages);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const senderRef = useRef("");
  const transportRef = useRef<RoomTransport | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const existing = localStorage.getItem("hush-device-v3");
    senderRef.current = existing || crypto.randomUUID();
    if (!existing) localStorage.setItem("hush-device-v3", senderRef.current);
    return () => transportRef.current?.close();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, aiMessages]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 2_400);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const beginHold = (event: PointerEvent<HTMLButtonElement>) => {
    if (mode !== "ai") return;
    event.currentTarget.setPointerCapture(event.pointerId);
    holdTimer.current = setTimeout(() => {
      setShowGate(true);
      navigator.vibrate?.(20);
    }, 900);
  };

  const cancelHold = () => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    holdTimer.current = null;
  };

  const unlock = async (event: FormEvent) => {
    event.preventDefault();
    const normalized = secret.trim();
    if (normalized.length < 16) {
      setGateError("为了安全，密钥至少需要 16 个字符");
      return;
    }
    setGateBusy(true);
    setGateError("");
    try {
      const [derived, { openRoom }] = await Promise.all([
        deriveRoom(normalized),
        import("./mqtt-room"),
      ]);
      transportRef.current?.close();
      setMessages([]);
      setStatus("connecting");
      transportRef.current = openRoom({
        room: derived.room,
        key: derived.key,
        senderId: senderRef.current,
        onStatus: setStatus,
        onMessage: (message) => {
          setMessages((items) => mergeMessage(items, {
            ...message,
            sender: message.senderId === senderRef.current ? "me" : "them",
          }));
        },
      });
      setMode("secret");
      setShowGate(false);
      setSecret("");
      setRevealSecret(false);
    } catch {
      setGateError("无法打开安全对话，请重试");
    } finally {
      setGateBusy(false);
    }
  };

  const lockRoom = () => {
    transportRef.current?.close();
    transportRef.current = null;
    setMessages([]);
    setStatus("offline");
    setMode("ai");
    setNotice("已返回普通对话");
  };

  const makeSecret = () => {
    setSecret(generateSharedSecret());
    setRevealSecret(true);
    setGateError("");
  };

  const copySecret = async () => {
    if (!secret) return;
    try {
      await navigator.clipboard.writeText(secret);
      setNotice("密钥已复制");
    } catch {
      setGateError("无法自动复制，请长按密钥复制");
    }
  };

  const send = async (event: FormEvent) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;

    if (mode === "ai") {
      setDraft("");
      setAiMessages((items) => [...items, {
        id: crypto.randomUUID(),
        senderId: senderRef.current,
        sender: "me",
        text,
        createdAt: Date.now(),
      }]);
      window.setTimeout(() => {
        setAiMessages((items) => [...items, {
          id: crypto.randomUUID(),
          senderId: "assistant",
          sender: "them",
          text: "我在听。你可以继续说说具体情况，我会帮你梳理思路。",
          createdAt: Date.now(),
        }]);
      }, 650);
      return;
    }

    if (status !== "online" || !transportRef.current) {
      setNotice("安全连接尚未就绪");
      return;
    }

    setDraft("");
    try {
      const message = await transportRef.current.send(text);
      setMessages((items) => mergeMessage(items, { ...message, sender: "me" }));
    } catch {
      setDraft(text);
      setNotice("发送失败，请检查网络");
    }
  };

  const activeMessages = mode === "ai" ? aiMessages : messages;
  const statusCopy = status === "online" ? "安全连接" : status === "connecting" ? "连接中" : "等待网络";

  return (
    <main className="app-shell">
      <section className="phone-app" aria-label="ChatGPT 移动对话">
        <header className="topbar">
          <button
            className="icon-button menu"
            aria-label={mode === "secret" ? "退出安全对话" : "打开菜单"}
            onClick={mode === "secret" ? lockRoom : undefined}
          >
            <span></span><span></span>
          </button>
          <button
            className="identity"
            onPointerDown={beginHold}
            onPointerUp={cancelHold}
            onPointerCancel={cancelHold}
            onPointerLeave={cancelHold}
            onContextMenu={(event) => event.preventDefault()}
            aria-label="ChatGPT"
          >
            <span className="identity-copy">
              <strong>ChatGPT <b>5.2</b></strong>
              <small>{mode === "secret" ? statusCopy : ""}</small>
            </span>
            <span className="model-chevron" aria-hidden="true">⌄</span>
          </button>
          <button className="icon-button compose" aria-label="新对话">＋</button>
        </header>

        <div className={`conversation ${mode}`} aria-live="polite">
          {mode === "secret" && <div className="day-label">今天</div>}
          {mode === "secret" && (
            <div className="encryption-note"><span>✓</span> 消息已端到端加密</div>
          )}
          {mode === "secret" && activeMessages.length === 0 && (
            <div className="empty-space" aria-hidden="true"></div>
          )}
          {activeMessages.map((message) => (
            <div className={`message-row ${message.sender}`} key={message.id}>
              {message.sender === "them" && (
                <div className={`avatar ${mode === "secret" ? "muted-avatar" : ""}`}>
                  {mode === "ai" ? "✦" : "A"}
                </div>
              )}
              <div className="message-content">
                <div className="bubble">{message.text}</div>
                {mode === "secret" && (
                  <time>{displayTime(message.createdAt)}{message.sender === "me" ? "  ✓✓" : ""}</time>
                )}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        <form className="composer" onSubmit={send}>
          <button type="button" className="attach" aria-label="添加附件">＋</button>
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="询问任何问题"
            aria-label="消息"
            maxLength={20_000}
          />
          <button className="send" aria-label="发送消息" disabled={!draft.trim()}>↑</button>
        </form>
        <div className="home-indicator"></div>

        {notice && <div className="toast" role="status">{notice}</div>}

        {showGate && (
          <div
            className="gate-backdrop"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget && !gateBusy) setShowGate(false);
            }}
          >
            <form className="gate" onSubmit={unlock}>
              <div className="lock-mark" aria-hidden="true">⌁</div>
              <h2>模型诊断</h2>
              <p>输入诊断访问令牌</p>
              <div className="secret-field">
                <input
                  autoFocus
                  type={revealSecret ? "text" : "password"}
                  value={secret}
                  onChange={(event) => setSecret(event.target.value)}
                  placeholder="访问密钥"
                  autoComplete="off"
                  spellCheck={false}
                />
                <button type="button" onClick={() => setRevealSecret((value) => !value)}>
                  {revealSecret ? "隐藏" : "显示"}
                </button>
              </div>
              <div className="token-actions">
                <button type="button" onClick={makeSecret}>生成高强度密钥</button>
                <button type="button" onClick={copySecret} disabled={!secret}>复制</button>
              </div>
              {gateError && <div className="gate-error">{gateError}</div>}
              <button type="submit" disabled={gateBusy}>{gateBusy ? "正在验证…" : "进入对话"}</button>
              <button type="button" className="cancel" onClick={() => setShowGate(false)} disabled={gateBusy}>取消</button>
            </form>
          </div>
        )}
      </section>
    </main>
  );
}
