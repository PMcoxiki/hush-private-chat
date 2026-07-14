import {
  type FormEvent,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
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

function Icon({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      {children}
    </svg>
  );
}

function MenuIcon() {
  return <Icon><path d="M4 7.5h16M4 16.5h16" /></Icon>;
}

function ComposeIcon() {
  return (
    <Icon>
      <path d="M13.5 5H6.8A2.8 2.8 0 0 0 4 7.8v9.4A2.8 2.8 0 0 0 6.8 20h9.4a2.8 2.8 0 0 0 2.8-2.8v-6.7" />
      <path d="m11 13 1.1-3.6L18.5 3a1.77 1.77 0 0 1 2.5 2.5l-6.4 6.4L11 13Z" />
    </Icon>
  );
}

function ChevronIcon() {
  return <Icon><path d="m8.5 10 3.5 3.5 3.5-3.5" /></Icon>;
}

function PlusIcon() {
  return <Icon><path d="M12 5v14M5 12h14" /></Icon>;
}

function ArrowUpIcon() {
  return <Icon><path d="m7 11 5-5 5 5M12 6v12" /></Icon>;
}

function WaveIcon() {
  return (
    <Icon>
      <path d="M5 10v4M8.5 7.5v9M12 5v14M15.5 8v8M19 10.5v3" />
    </Icon>
  );
}

function CopyIcon() {
  return (
    <Icon>
      <rect x="8" y="8" width="11" height="11" rx="2" />
      <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
    </Icon>
  );
}

function SpeakerIcon() {
  return (
    <Icon>
      <path d="M5 10v4h3l4 3V7l-4 3H5Z" />
      <path d="M15 9.5a4 4 0 0 1 0 5M17.5 7a7.4 7.4 0 0 1 0 10" />
    </Icon>
  );
}

function ThumbIcon() {
  return (
    <Icon>
      <path d="M8.5 10 11 4.8c.5-1 1.8-.9 2.1-.2.3.8.1 2.2-.3 3.4H18a2 2 0 0 1 1.9 2.5l-1.6 6A2 2 0 0 1 16.4 18H8.5v-8Z" />
      <path d="M4 10h4.5v8H4z" />
    </Icon>
  );
}

function CloseIcon() {
  return <Icon><path d="m6 6 12 12M18 6 6 18" /></Icon>;
}

function mergeMessage(items: UiMessage[], message: UiMessage) {
  const next = items.some((item) => item.id === message.id)
    ? items.map((item) => (item.id === message.id ? message : item))
    : [...items, message];
  return next.sort((a, b) => a.createdAt - b.createdAt);
}

export default function App() {
  const [mode, setMode] = useState<Mode>("ai");
  const [showGate, setShowGate] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [secret, setSecret] = useState("");
  const [revealSecret, setRevealSecret] = useState(false);
  const [gateBusy, setGateBusy] = useState(false);
  const [gateError, setGateError] = useState("");
  const [draft, setDraft] = useState("");
  const [notice, setNotice] = useState("");
  const [status, setStatus] = useState<ConnectionStatus>("offline");
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [aiMessages, setAiMessages] = useState<UiMessage[]>([]);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const senderRef = useRef("");
  const transportRef = useRef<RoomTransport | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);

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
    const field = composerRef.current;
    if (!field) return;
    field.style.height = "auto";
    field.style.height = `${Math.min(field.scrollHeight, 128)}px`;
  }, [draft]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 2_400);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const beginHold = (event: PointerEvent<HTMLButtonElement>) => {
    if (mode !== "ai") return;
    event.currentTarget.setPointerCapture(event.pointerId);
    if (holdTimer.current) clearTimeout(holdTimer.current);
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
        onStatus: (nextStatus) => {
          setStatus(nextStatus);
          if (nextStatus === "online") setNotice("安全频道已连接");
          if (nextStatus === "offline") setNotice("安全频道正在等待网络");
        },
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

  const startNewChat = () => {
    if (mode === "secret") lockRoom();
    setAiMessages([]);
    setDraft("");
    setShowSidebar(false);
    setNotice("已开始新对话");
  };

  const handleMenu = () => {
    if (mode === "secret") {
      lockRoom();
      return;
    }
    setShowSidebar(true);
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

  const copyMessage = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setNotice("已复制");
    } catch {
      setNotice("无法自动复制");
    }
  };

  const readMessage = (text: string) => {
    if (!("speechSynthesis" in window)) {
      setNotice("当前浏览器不支持朗读");
      return;
    }
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
    setNotice("正在朗读");
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
          text: "当然可以。告诉我你想解决的具体问题，我会帮你把思路一步步整理清楚。",
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

  const handleComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  };

  const activeMessages = mode === "ai" ? aiMessages : messages;
  const statusCopy = status === "online" ? "安全频道已连接" : status === "connecting" ? "安全频道连接中" : "安全频道离线";

  return (
    <main className="app-shell">
      <section className="phone-app" aria-label="ChatGPT 移动对话">
        <header className="topbar">
          <button className="icon-button" aria-label={mode === "secret" ? "退出安全对话" : "打开侧边栏"} onClick={handleMenu}>
            <MenuIcon />
          </button>
          <button
            className="identity"
            onPointerDown={beginHold}
            onPointerUp={cancelHold}
            onPointerCancel={cancelHold}
            onPointerLeave={cancelHold}
            onContextMenu={(event) => event.preventDefault()}
            aria-label="ChatGPT 5.2"
          >
            <strong>ChatGPT <span>5.2</span></strong>
            <ChevronIcon />
          </button>
          <button className="icon-button" aria-label="新对话" onClick={startNewChat}>
            <ComposeIcon />
          </button>
        </header>

        <div className={`conversation ${mode}`} aria-live="polite">
          {activeMessages.length === 0 ? (
            <div className="welcome-state">
              <h1>有什么可以帮忙的？</h1>
            </div>
          ) : activeMessages.map((message) => (
            <article className={`message-row ${message.sender}`} key={message.id}>
              <div className="message-content">
                <div className="bubble">{message.text}</div>
                {message.sender === "them" ? (
                  <div className="message-actions" aria-label="消息操作">
                    <button type="button" aria-label="复制" onClick={() => copyMessage(message.text)}><CopyIcon /></button>
                    <button type="button" aria-label="朗读" onClick={() => readMessage(message.text)}><SpeakerIcon /></button>
                    <button type="button" aria-label="有帮助" onClick={() => setNotice("感谢你的反馈")}><ThumbIcon /></button>
                  </div>
                ) : null}
              </div>
            </article>
          ))}
          <div ref={bottomRef} />
        </div>

        <div className="composer-zone">
          <form className="composer" onSubmit={send}>
            <button type="button" className="tool-button" aria-label="添加照片或文件" onClick={() => setNotice("可添加照片或文件")}>
              <PlusIcon />
            </button>
            <textarea
              ref={composerRef}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={handleComposerKeyDown}
              placeholder="询问任何问题"
              aria-label="消息"
              rows={1}
              maxLength={20_000}
            />
            <button
              type={draft.trim() ? "submit" : "button"}
              className={`composer-action ${draft.trim() ? "send-active" : "voice"}`}
              aria-label={draft.trim() ? "发送消息" : "开始语音模式"}
              onClick={draft.trim() ? undefined : () => setNotice("语音模式暂不可用")}
            >
              {draft.trim() ? <ArrowUpIcon /> : <WaveIcon />}
            </button>
          </form>
          <p className="disclaimer">ChatGPT 可能会出错，请核查重要信息。</p>
        </div>

        <span className="sr-only" aria-live="polite">{mode === "secret" ? statusCopy : ""}</span>
        {notice ? <div className="toast" role="status">{notice}</div> : null}

        {showSidebar ? (
          <div className="sidebar-backdrop" onMouseDown={(event) => {
            if (event.target === event.currentTarget) setShowSidebar(false);
          }}>
            <aside className="sidebar" aria-label="对话侧边栏">
              <div className="sidebar-header">
                <button type="button" aria-label="关闭侧边栏" onClick={() => setShowSidebar(false)}><CloseIcon /></button>
                <button type="button" aria-label="新对话" onClick={startNewChat}><ComposeIcon /></button>
              </div>
              <button type="button" className="sidebar-home" onClick={() => setShowSidebar(false)}>
                <span className="sidebar-mark">✦</span><strong>ChatGPT</strong>
              </button>
              <div className="history-label">今天</div>
              <button type="button" className="history-item" onClick={() => setShowSidebar(false)}>整理今天的工作计划</button>
              <button type="button" className="history-item" onClick={() => setShowSidebar(false)}>帮我润色一段文字</button>
              <div className="sidebar-profile"><span>•••</span><strong>设置与帮助</strong></div>
            </aside>
          </div>
        ) : null}

        {showGate ? (
          <div
            className="gate-backdrop"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget && !gateBusy) setShowGate(false);
            }}
          >
            <form className="gate" onSubmit={unlock}>
              <div className="sheet-handle" aria-hidden="true" />
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
              {gateError ? <div className="gate-error">{gateError}</div> : null}
              <button type="submit" disabled={gateBusy}>{gateBusy ? "正在验证…" : "进入对话"}</button>
              <button type="button" className="cancel" onClick={() => setShowGate(false)} disabled={gateBusy}>取消</button>
            </form>
          </div>
        ) : null}
      </section>
    </main>
  );
}
