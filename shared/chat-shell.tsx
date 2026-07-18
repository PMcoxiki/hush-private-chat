import {
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
} from "react";
import { groupPrivateMessages, type CoverModel } from "./cover-chat";
import { settleSessionOperation } from "./private-session";
import { RichText, ThinkingDots } from "./rich-text";
import { useCoverChat } from "./use-cover-chat";

type Mode = "ai" | "secret";
type Theme = "dark" | "light";
export type ConnectionStatus = "offline" | "connecting" | "online";
export type PrivateMessage = { id: string; senderId: string; text: string; createdAt: number };
export type PrivateRoomSession = {
  close: () => void;
  send: (text: string) => Promise<PrivateMessage>;
};
export type PrivateRoomHandlers = {
  onStatus: (status: ConnectionStatus) => void;
  onMessage: (message: PrivateMessage) => void;
};
export type ChatShellProps = {
  createSharedSecret: () => string;
  openPrivateRoom: (
    secret: string,
    senderId: string,
    handlers: PrivateRoomHandlers,
  ) => Promise<PrivateRoomSession>;
};
type UiMessage = PrivateMessage & { sender: "me" | "them" };
type LocalAttachment = { id: string; name: string; kind: "photo" | "file" };

const THEME_STORAGE_KEY = "chatgpt-cover-theme-v1";

const MODEL_OPTIONS: ReadonlyArray<{ id: CoverModel; label: string; description: string }> = [
  { id: "auto", label: "自动", description: "根据问题自动调整回答方式" },
  { id: "quick", label: "快速", description: "更快给出简洁回答" },
  { id: "thinking", label: "深度思考", description: "多花一点时间梳理复杂问题" },
];

function Icon({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">{children}</svg>;
}

function MenuIcon() { return <Icon><path d="M4 7.5h16M4 16.5h16" /></Icon>; }
function ChevronIcon() { return <Icon><path d="m8.5 10 3.5 3.5 3.5-3.5" /></Icon>; }
function PlusIcon() { return <Icon><path d="M12 5v14M5 12h14" /></Icon>; }
function ArrowUpIcon() { return <Icon><path d="m7 11 5-5 5 5M12 6v12" /></Icon>; }
function CloseIcon() { return <Icon><path d="m6 6 12 12M18 6 6 18" /></Icon>; }
function SearchIcon() { return <Icon><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></Icon>; }
function CheckIcon() { return <Icon><path d="m5 12.5 4.2 4.2L19 7" /></Icon>; }
function PhotoIcon() { return <Icon><rect x="3.5" y="4" width="17" height="16" rx="3" /><circle cx="9" cy="9" r="1.5" /><path d="m5 17 4.5-4.5 3 3 2-2 4.5 4.5" /></Icon>; }
function FileIcon() { return <Icon><path d="M7 3.5h6l4 4V20H7z" /><path d="M13 3.5V8h4M9.5 12h5M9.5 15h5" /></Icon>; }
function CameraIcon() { return <Icon><path d="M4 8.5h3l1.5-2h7l1.5 2h3v10H4z" /><circle cx="12" cy="13" r="3.2" /></Icon>; }
function ComposeIcon() {
  return <Icon><path d="M13.5 5H6.8A2.8 2.8 0 0 0 4 7.8v9.4A2.8 2.8 0 0 0 6.8 20h9.4a2.8 2.8 0 0 0 2.8-2.8v-6.7" /><path d="m11 13 1.1-3.6L18.5 3a1.77 1.77 0 0 1 2.5 2.5l-6.4 6.4L11 13Z" /></Icon>;
}
function WaveIcon() { return <Icon><path d="M5 10v4M8.5 7.5v9M12 5v14M15.5 8v8M19 10.5v3" /></Icon>; }
function CopyIcon() { return <Icon><rect x="8" y="8" width="11" height="11" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></Icon>; }
function SpeakerIcon() { return <Icon><path d="M5 10v4h3l4 3V7l-4 3H5Z" /><path d="M15 9.5a4 4 0 0 1 0 5M17.5 7a7.4 7.4 0 0 1 0 10" /></Icon>; }
function ThumbIcon() { return <Icon><path d="M8.5 10 11 4.8c.5-1 1.8-.9 2.1-.2.3.8.1 2.2-.3 3.4H18a2 2 0 0 1 1.9 2.5l-1.6 6A2 2 0 0 1 16.4 18H8.5v-8Z" /><path d="M4 10h4.5v8H4z" /></Icon>; }

function KnotMark({ small = false }: { small?: boolean }) {
  return (
    <span className={`knot-mark${small ? " small" : ""}`} aria-hidden="true">
      <span className="knot-art" style={{ backgroundImage: "url('./app-icon.png')" }} />
    </span>
  );
}

function mergeMessage(items: UiMessage[], message: UiMessage) {
  const next = items.some((item) => item.id === message.id)
    ? items.map((item) => item.id === message.id ? message : item)
    : [...items, message];
  return next.sort((a, b) => a.createdAt - b.createdAt);
}

function showPrivacyShield() {
  document.documentElement.dataset.privateLocked = "true";
}

function notifyNativePrivacyReady() {
  const nativeWindow = window as Window & {
    webkit?: {
      messageHandlers?: {
        privacyReady?: { postMessage: (message: string) => void };
      };
    };
  };
  nativeWindow.webkit?.messageHandlers?.privacyReady?.postMessage("cover-ready");
}

function hidePrivacyShieldAfterPaint() {
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      delete document.documentElement.dataset.privateLocked;
      notifyNativePrivacyReady();
    });
  });
}

function applyDocumentTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
    ?.setAttribute("content", theme === "dark" ? "#212121" : "#ffffff");
}

function readInitialTheme(): Theme {
  if (typeof document === "undefined") return "dark";
  try {
    const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    if (storedTheme === "light" || storedTheme === "dark") return storedTheme;
  } catch {
    // Storage can be unavailable in restricted browser modes.
  }
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

function ProgressivePrivateText({ text, animate }: { text: string; animate: boolean }) {
  const [visible, setVisible] = useState("");
  const [thinking, setThinking] = useState(true);
  const previousRef = useRef("");

  useEffect(() => {
    if (!animate) return;
    const previous = text.startsWith(previousRef.current) ? previousRef.current : "";
    let streamTimer = 0;
    const setupTimer = window.setTimeout(() => {
      setVisible(previous);
      setThinking(true);
      streamTimer = window.setTimeout(() => {
        setThinking(false);
        let length = previous.length;
        const stream = () => {
          length = Math.min(text.length, length + 5);
          setVisible(text.slice(0, length));
          previousRef.current = text.slice(0, length);
          if (length < text.length) streamTimer = window.setTimeout(stream, 34);
        };
        stream();
      }, previous ? 320 : 560);
    }, 0);
    return () => {
      window.clearTimeout(setupTimer);
      window.clearTimeout(streamTimer);
    };
  }, [animate, text]);

  if (!animate) return <RichText text={text} />;
  return <>{visible ? <RichText text={visible} /> : null}{thinking ? <ThinkingDots /> : null}</>;
}

export function ChatShell({ createSharedSecret, openPrivateRoom }: ChatShellProps) {
  const cover = useCoverChat();
  const activateEmergencyCover = cover.activateEmergencyCover;
  const [mode, setMode] = useState<Mode>("ai");
  const [showGate, setShowGate] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showModels, setShowModels] = useState(false);
  const [showAttachments, setShowAttachments] = useState(false);
  const [showVoice, setShowVoice] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [theme, setTheme] = useState<Theme>(readInitialTheme);
  const [secret, setSecret] = useState("");
  const [revealSecret, setRevealSecret] = useState(false);
  const [gateBusy, setGateBusy] = useState(false);
  const [gateError, setGateError] = useState("");
  const [draft, setDraft] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [attachments, setAttachments] = useState<LocalAttachment[]>([]);
  const [status, setStatus] = useState<ConnectionStatus>("offline");
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [senderId, setSenderId] = useState("");
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdTriggered = useRef(false);
  const transportRef = useRef<PrivateRoomSession | null>(null);
  const roomSessionRef = useRef(0);
  const privateExposureRef = useRef(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const senderTimer = window.setTimeout(() => {
      const existing = localStorage.getItem("hush-device-v3");
      const nextSenderId = existing || crypto.randomUUID();
      if (!existing) localStorage.setItem("hush-device-v3", nextSenderId);
      setSenderId(nextSenderId);
    }, 0);
    return () => {
      window.clearTimeout(senderTimer);
      transportRef.current?.close();
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [cover.messages, messages]);

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

  const privateTurns = useMemo(
    () => groupPrivateMessages(messages, senderId),
    [messages, senderId],
  );
  const newestAssistantTurn = [...privateTurns].reverse().find((turn) => turn.sender === "them")?.id;
  const filteredHistory = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return cover.conversations;
    return cover.conversations.filter((conversation) => (
      conversation.title.toLocaleLowerCase().includes(query)
      || conversation.messages.some((message) => message.text.toLocaleLowerCase().includes(query))
    ));
  }, [cover.conversations, search]);

  const beginHold = (event: PointerEvent<HTMLButtonElement>) => {
    if (mode !== "ai") return;
    event.currentTarget.setPointerCapture(event.pointerId);
    holdTriggered.current = false;
    if (holdTimer.current) clearTimeout(holdTimer.current);
    holdTimer.current = setTimeout(() => {
      holdTriggered.current = true;
      privateExposureRef.current = true;
      setShowModels(false);
      setShowGate(true);
      navigator.vibrate?.(20);
    }, 900);
  };

  const finishHold = () => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    holdTimer.current = null;
    if (!holdTriggered.current && mode === "ai") setShowModels(true);
  };

  const cancelHold = () => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    holdTimer.current = null;
  };

  const clearPrivateState = useCallback(() => {
    roomSessionRef.current += 1;
    privateExposureRef.current = false;
    transportRef.current?.close();
    transportRef.current = null;
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    setMessages([]);
    setStatus("offline");
    setSecret("");
    setRevealSecret(false);
    setGateBusy(false);
    setGateError("");
    setShowGate(false);
  }, []);

  const activateCoverState = useCallback((keepShield: boolean) => {
    showPrivacyShield();
    clearPrivateState();
    activateEmergencyCover();
    setMode("ai");
    setDraft("");
    setAttachments([]);
    setShowSidebar(false);
    setShowModels(false);
    setNotice("");
    if (!keepShield) hidePrivacyShieldAfterPaint();
  }, [activateEmergencyCover, clearPrivateState]);

  const activateCover = useCallback(() => {
    activateCoverState(false);
  }, [activateCoverState]);

  const lockPrivateForLifecycle = useEffectEvent((keepShield: boolean) => {
    activateCoverState(keepShield);
  });

  useEffect(() => {
    const lockForBackground = () => {
      if (document.visibilityState === "hidden" && privateExposureRef.current) {
        lockPrivateForLifecycle(true);
      }
    };
    const lockForPageHide = () => {
      if (privateExposureRef.current) lockPrivateForLifecycle(true);
    };
    const restoreCover = () => {
      if (document.visibilityState !== "visible") return;
      if (privateExposureRef.current) lockPrivateForLifecycle(false);
      else hidePrivacyShieldAfterPaint();
    };
    document.addEventListener("visibilitychange", lockForBackground);
    document.addEventListener("visibilitychange", restoreCover);
    window.addEventListener("pagehide", lockForPageHide);
    document.addEventListener("app-inactive", lockForPageHide);
    document.addEventListener("app-active", restoreCover);
    window.addEventListener("pageshow", restoreCover);
    restoreCover();
    return () => {
      document.removeEventListener("visibilitychange", lockForBackground);
      document.removeEventListener("visibilitychange", restoreCover);
      window.removeEventListener("pagehide", lockForPageHide);
      document.removeEventListener("app-inactive", lockForPageHide);
      document.removeEventListener("app-active", restoreCover);
      window.removeEventListener("pageshow", restoreCover);
    };
  }, []);

  const unlock = async (event: FormEvent) => {
    event.preventDefault();
    const normalized = secret.trim();
    if (normalized.length < 16) {
      setGateError("访问令牌至少需要 16 个字符");
      return;
    }
    privateExposureRef.current = true;
    setGateBusy(true);
    setGateError("");
    const roomSession = ++roomSessionRef.current;
    transportRef.current?.close();
    transportRef.current = null;
    setMessages([]);
    setStatus("connecting");
    const result = await settleSessionOperation(
      Promise.resolve().then(() => openPrivateRoom(normalized, senderId, {
        onStatus: (nextStatus) => {
          if (roomSession !== roomSessionRef.current) return;
          setStatus(nextStatus);
          if (nextStatus === "offline") setNotice("暂时无法响应，请稍后再试");
        },
        onMessage: (message) => {
          if (roomSession !== roomSessionRef.current) return;
          setMessages((items) => mergeMessage(items, {
            ...message,
            sender: message.senderId === senderId ? "me" : "them",
          }));
        },
      })),
      roomSession,
      () => roomSessionRef.current,
    );

    if (!result.current) {
      if (result.status === "fulfilled") result.value.close();
      return;
    }
    if (result.status === "rejected") {
      setGateError("无法完成诊断，请稍后重试");
      setGateBusy(false);
      return;
    }
    if (document.visibilityState === "hidden") {
      result.value.close();
      activateCoverState(true);
      return;
    }

    transportRef.current = result.value;
    privateExposureRef.current = true;
    setMode("secret");
    setShowGate(false);
    setSecret("");
    setRevealSecret(false);
    setGateBusy(false);
  };

  const startNewChat = () => {
    if (mode === "secret") clearPrivateState();
    cover.startNew();
    setMode("ai");
    setDraft("");
    setAttachments([]);
    setShowSidebar(false);
    setShowModels(false);
  };

  const handleMenu = () => {
    if (mode === "secret") {
      activateCover();
      return;
    }
    setShowSidebar(true);
  };

  const makeSecret = () => {
    privateExposureRef.current = true;
    setSecret(createSharedSecret());
    setRevealSecret(true);
    setGateError("");
  };

  const copySecret = async () => {
    if (!secret) return;
    try {
      await navigator.clipboard.writeText(secret);
      setNotice("访问令牌已复制");
    } catch {
      setGateError("无法自动复制，请长按复制");
    }
  };

  const selectTheme = (nextTheme: Theme) => {
    applyDocumentTheme(nextTheme);
    setTheme(nextTheme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    } catch {
      // The selected theme still applies for the current session.
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
      setNotice("当前设备无法朗读");
      return;
    }
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
  };

  const addFiles = (event: ChangeEvent<HTMLInputElement>, kind: LocalAttachment["kind"]) => {
    const files = Array.from(event.target.files || []);
    setAttachments((items) => [...items, ...files.map((file) => ({
      id: crypto.randomUUID(),
      name: file.name,
      kind,
    }))].slice(-4));
    setShowAttachments(false);
    event.target.value = "";
  };

  const send = async (event: FormEvent) => {
    event.preventDefault();
    const attachmentCopy = attachments.map((attachment) => attachment.name).join("、");
    const text = draft.trim() || (attachmentCopy ? `请帮我整理附件：${attachmentCopy}` : "");
    if (!text) return;

    if (mode === "ai") {
      const prompt = attachmentCopy && draft.trim() ? `${draft.trim()}\n\n附件：${attachmentCopy}` : text;
      if (cover.ask(prompt)) {
        setDraft("");
        setAttachments([]);
      }
      return;
    }

    if (status !== "online" || !transportRef.current) {
      setNotice("暂时无法生成，请稍后再试");
      return;
    }
    setDraft("");
    const roomSession = roomSessionRef.current;
    const activeTransport = transportRef.current;
    try {
      const result = await settleSessionOperation(
        activeTransport.send(text),
        roomSession,
        () => roomSessionRef.current,
      );
      if (!result.current) return;
      if (result.status === "rejected") throw result.error;
      setMessages((items) => mergeMessage(items, { ...result.value, sender: "me" }));
    } catch {
      if (roomSession !== roomSessionRef.current) return;
      setDraft(text);
      setNotice("暂时无法生成，请稍后再试");
    }
  };

  const handleComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  };

  const renderActions = (text: string) => (
    <div className="message-actions" aria-label="回答操作">
      <button type="button" aria-label="复制" onClick={() => copyMessage(text)}><CopyIcon /></button>
      <button type="button" aria-label="朗读" onClick={() => readMessage(text)}><SpeakerIcon /></button>
      <button type="button" aria-label="有帮助" onClick={() => setNotice("感谢你的反馈")}><ThumbIcon /></button>
    </div>
  );

  return (
    <main className="app-shell">
      <section className="phone-app" aria-label="ChatGPT 移动对话">
        <div className="privacy-shield" aria-hidden="true">
          <div className="privacy-topbar"><MenuIcon /><strong>ChatGPT</strong><ComposeIcon /></div>
          <div className="privacy-welcome"><KnotMark /><h1>有什么可以帮忙的？</h1></div>
          <div className="privacy-composer"><PlusIcon /><span>询问任何问题</span><WaveIcon /></div>
        </div>
        <header className="topbar">
          <button className="icon-button" aria-label="打开侧边栏" onClick={handleMenu}><MenuIcon /></button>
          <button
            className="identity"
            onPointerDown={beginHold}
            onPointerUp={finishHold}
            onPointerCancel={cancelHold}
            onPointerLeave={cancelHold}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") setShowModels(true);
            }}
            onContextMenu={(event) => event.preventDefault()}
            aria-label="ChatGPT 模型选择"
          >
            <strong>ChatGPT</strong><ChevronIcon />
          </button>
          <button className="icon-button" aria-label="新对话" onClick={startNewChat}><ComposeIcon /></button>
        </header>

        <div className={`conversation ${mode}`} aria-live="polite">
          {mode === "ai" ? (
            cover.messages.length === 0 ? <div className="welcome-state"><KnotMark /><h1>有什么可以帮忙的？</h1></div> : cover.messages.map((message) => (
              <article className={`message-row ${message.sender}`} key={message.id}>
                <div className="message-content">
                  <div className="bubble">
                    {message.phase === "thinking" ? <ThinkingDots /> : <RichText text={message.text} />}
                  </div>
                  {message.sender === "them" && !message.phase ? renderActions(message.text) : null}
                </div>
              </article>
            ))
          ) : (
            privateTurns.length === 0 ? <div className="private-thinking"><ThinkingDots /></div> : privateTurns.map((turn) => (
              <article className={`message-row ${turn.sender}`} key={turn.id}>
                <div className="message-content">
                  <div className="bubble">
                    {turn.sender === "them"
                      ? <ProgressivePrivateText text={turn.text} animate={turn.id === newestAssistantTurn} />
                      : <RichText text={turn.text} />}
                  </div>
                  {turn.sender === "them" ? renderActions(turn.text) : null}
                </div>
              </article>
            ))
          )}
          <div ref={bottomRef} />
        </div>

        <div className="composer-zone">
          {attachments.length ? <div className="attachment-chips">{attachments.map((attachment) => (
            <span key={attachment.id}>{attachment.kind === "photo" ? <PhotoIcon /> : <FileIcon />}<b>{attachment.name}</b><button type="button" aria-label={`移除 ${attachment.name}`} onClick={() => setAttachments((items) => items.filter((item) => item.id !== attachment.id))}>×</button></span>
          ))}</div> : null}
          <form className="composer" onSubmit={send}>
            <button type="button" className="tool-button" aria-label={mode === "secret" ? "返回对话" : "添加照片或文件"} onClick={mode === "secret" ? activateCover : () => setShowAttachments(true)}><PlusIcon /></button>
            <textarea ref={composerRef} value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={handleComposerKeyDown} placeholder="询问任何问题" aria-label="消息" rows={1} maxLength={20_000} />
            <button type={draft.trim() || attachments.length ? "submit" : "button"} className={`composer-action ${draft.trim() || attachments.length ? "send-active" : "voice"}`} aria-label={draft.trim() || attachments.length ? "发送消息" : "开始语音模式"} onClick={draft.trim() || attachments.length ? undefined : () => setShowVoice(true)}>
              {draft.trim() || attachments.length ? <ArrowUpIcon /> : <WaveIcon />}
            </button>
          </form>
          <p className="disclaimer">ChatGPT 可能会出错，请核查重要信息。</p>
        </div>

        <span className="sr-only" aria-live="polite">{mode === "secret" ? (status === "online" ? "服务可用" : status === "connecting" ? "服务准备中" : "服务暂时离线") : ""}</span>
        {notice ? <div className="toast" role="status">{notice}</div> : null}

        {showSidebar ? <div className="sidebar-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setShowSidebar(false)}>
          <aside className="sidebar" aria-label="对话侧边栏">
            <div className="sidebar-header"><button type="button" aria-label="关闭侧边栏" onClick={() => setShowSidebar(false)}><CloseIcon /></button><button type="button" aria-label="新对话" onClick={startNewChat}><ComposeIcon /></button></div>
            <button type="button" className="sidebar-home" onClick={startNewChat}><KnotMark small /><strong>ChatGPT</strong></button>
            <label className="history-search"><SearchIcon /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索对话" aria-label="搜索对话" /></label>
            <div className="history-label">最近</div>
            <div className="history-list">
              {filteredHistory.length ? filteredHistory.map((conversation) => <button type="button" className={`history-item${cover.activeId === conversation.id ? " active" : ""}`} key={conversation.id} onClick={() => { cover.selectConversation(conversation.id); setShowSidebar(false); }}>{conversation.title}</button>) : <p className="history-empty">{search ? "没有找到相关对话" : "你的本地对话会显示在这里"}</p>}
            </div>
            <button type="button" className="sidebar-profile" onClick={() => setShowSettings(true)}><span>•••</span><span><strong>设置与帮助</strong><small>本地模式</small></span></button>
          </aside>
        </div> : null}

        {showModels ? <div className="sheet-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setShowModels(false)}><section className="option-sheet" aria-label="选择回答模式"><div className="sheet-handle" /><h2>选择回答模式</h2>{MODEL_OPTIONS.map((option) => <button type="button" className="model-option" key={option.id} onClick={() => { cover.setModel(option.id); setShowModels(false); }}><span><strong>{option.label}</strong><small>{option.description}</small></span>{cover.selectedModel === option.id ? <CheckIcon /> : null}</button>)}</section></div> : null}

        {showAttachments ? <div className="sheet-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setShowAttachments(false)}><section className="option-sheet attachment-sheet" aria-label="添加内容"><div className="sheet-handle" /><h2>添加内容</h2><div className="attachment-options"><button type="button" onClick={() => cameraInputRef.current?.click()}><CameraIcon /><span>拍照</span></button><button type="button" onClick={() => photoInputRef.current?.click()}><PhotoIcon /><span>照片</span></button><button type="button" onClick={() => fileInputRef.current?.click()}><FileIcon /><span>文件</span></button></div><p>所选内容只在这台设备上显示，不会上传。</p></section></div> : null}
        <input ref={cameraInputRef} hidden type="file" accept="image/*" capture="environment" onChange={(event) => addFiles(event, "photo")} />
        <input ref={photoInputRef} hidden type="file" accept="image/*" multiple onChange={(event) => addFiles(event, "photo")} />
        <input ref={fileInputRef} hidden type="file" multiple onChange={(event) => addFiles(event, "file")} />

        {showVoice ? <section className="voice-mode" aria-label="语音模式"><button type="button" className="voice-close" aria-label="关闭语音模式" onClick={() => setShowVoice(false)}><CloseIcon /></button><KnotMark /><p>正在聆听</p><div className="voice-bars" aria-hidden="true">{Array.from({ length: 9 }, (_, index) => <i key={index} />)}</div><small>在本机等待语音输入</small><button type="button" className="voice-end" onClick={() => setShowVoice(false)}>结束</button></section> : null}

        {showSettings ? <div className="sheet-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setShowSettings(false)}><section className="option-sheet settings-sheet"><div className="sheet-handle" /><h2>设置与帮助</h2><div className="settings-row"><span>回答模式</span><strong>{MODEL_OPTIONS.find((option) => option.id === cover.selectedModel)?.label}</strong></div><div className="settings-row"><span>外观</span><div className="theme-options" role="group" aria-label="外观模式"><button type="button" aria-pressed={theme === "dark"} onClick={() => selectTheme("dark")}>深色</button><button type="button" aria-pressed={theme === "light"} onClick={() => selectTheme("light")}>浅色</button></div></div><div className="settings-row"><span>对话存储</span><strong>仅限本机</strong></div><p>普通咨询记录最多保留 12 条。回答由本地规则生成，断网也能使用。</p><button type="button" className="sheet-done" onClick={() => { setShowSettings(false); setShowSidebar(false); }}>完成</button></section></div> : null}

        {showGate ? <div className="gate-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !gateBusy && clearPrivateState()}><form className="gate" onSubmit={unlock}><div className="sheet-handle" /><div className="lock-mark" aria-hidden="true">⌁</div><h2>模型诊断</h2><p>输入诊断访问令牌</p><div className="secret-field"><input autoFocus type={revealSecret ? "text" : "password"} value={secret} onChange={(event) => { privateExposureRef.current = true; setSecret(event.target.value); }} placeholder="访问令牌" autoComplete="off" spellCheck={false} /><button type="button" onClick={() => setRevealSecret((value) => !value)}>{revealSecret ? "隐藏" : "显示"}</button></div><div className="token-actions"><button type="button" onClick={makeSecret}>生成访问令牌</button><button type="button" onClick={copySecret} disabled={!secret}>复制</button></div>{gateError ? <div className="gate-error">{gateError}</div> : null}<button type="submit" disabled={gateBusy}>{gateBusy ? "正在诊断…" : "开始诊断"}</button><button type="button" className="cancel" onClick={clearPrivateState} disabled={gateBusy}>取消</button></form></div> : null}
      </section>
    </main>
  );
}
