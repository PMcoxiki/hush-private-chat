import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  COVER_HISTORY_KEY,
  type CoverConversation,
  type CoverMessage,
  type CoverModel,
  generateCoverReply,
  normalizeCoverHistory,
  selectEmergencyCover,
  serializeCoverHistory,
} from "./cover-chat";

export type DisplayedCoverMessage = CoverMessage & {
  phase?: "thinking" | "streaming";
};

const ACTIVE_COVER_KEY = "local-consultation-active-v2";
const MODEL_COVER_KEY = "local-consultation-model-v2";

type PendingReply = {
  conversationId: string;
  id: string;
  fullText: string;
  visibleText: string;
  createdAt: number;
  phase: "thinking" | "streaming";
};

function newId(prefix: string) {
  return globalThis.crypto?.randomUUID?.() || `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function modelTiming(model: CoverModel) {
  if (model === "quick") return { thinkingScale: 0.55, chunk: 9 };
  if (model === "thinking") return { thinkingScale: 1.45, chunk: 4 };
  return { thinkingScale: 1, chunk: 6 };
}

export function useCoverChat() {
  const [conversations, setConversations] = useState<CoverConversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [defaultModel, setDefaultModel] = useState<CoverModel>("auto");
  const [pending, setPending] = useState<PendingReply | null>(null);
  const hydratedRef = useRef(false);
  const timersRef = useRef<Set<number>>(new Set());

  const clearTimers = useCallback(() => {
    for (const timer of timersRef.current) window.clearTimeout(timer);
    timersRef.current.clear();
  }, []);

  useEffect(() => {
    const hydrationTimer = window.setTimeout(() => {
      try {
        const saved = localStorage.getItem(COVER_HISTORY_KEY);
        const next = saved ? normalizeCoverHistory(JSON.parse(saved)) : [];
        const savedActive = localStorage.getItem(ACTIVE_COVER_KEY);
        const savedModel = localStorage.getItem(MODEL_COVER_KEY) as CoverModel | null;
        setConversations(next);
        setActiveId(next.some((item) => item.id === savedActive) ? savedActive : (next[0]?.id || null));
        if (savedModel === "auto" || savedModel === "quick" || savedModel === "thinking") {
          setDefaultModel(savedModel);
        }
      } catch {
        setConversations([]);
        setActiveId(null);
      } finally {
        hydratedRef.current = true;
      }
    }, 0);
    return () => {
      window.clearTimeout(hydrationTimer);
      clearTimers();
    };
  }, [clearTimers]);

  useEffect(() => {
    if (!hydratedRef.current) return;
    localStorage.setItem(COVER_HISTORY_KEY, serializeCoverHistory(conversations));
  }, [conversations]);

  useEffect(() => {
    if (!hydratedRef.current) return;
    if (activeId) localStorage.setItem(ACTIVE_COVER_KEY, activeId);
    else localStorage.removeItem(ACTIVE_COVER_KEY);
  }, [activeId]);

  useEffect(() => {
    if (!hydratedRef.current) return;
    localStorage.setItem(MODEL_COVER_KEY, defaultModel);
  }, [defaultModel]);

  const activeConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === activeId) || null,
    [activeId, conversations],
  );
  const selectedModel = activeConversation?.model || defaultModel;

  const messages = useMemo<DisplayedCoverMessage[]>(() => {
    const complete = activeConversation?.messages || [];
    if (!pending || pending.conversationId !== activeId) return complete;
    return [...complete, {
      id: pending.id,
      sender: "them",
      text: pending.visibleText,
      createdAt: pending.createdAt,
      phase: pending.phase,
    }];
  }, [activeConversation, activeId, pending]);

  const replaceConversation = useCallback((conversation: CoverConversation) => {
    setConversations((items) => [
      conversation,
      ...items.filter((item) => item.id !== conversation.id),
    ].slice(0, 12));
    setActiveId(conversation.id);
  }, []);

  const startNew = useCallback(() => {
    clearTimers();
    setPending(null);
    setActiveId(null);
  }, [clearTimers]);

  const selectConversation = useCallback((id: string) => {
    clearTimers();
    setPending(null);
    setActiveId(id);
  }, [clearTimers]);

  const setModel = useCallback((model: CoverModel) => {
    setDefaultModel(model);
    setConversations((items) => items.map((conversation) => (
      conversation.id === activeId ? { ...conversation, model } : conversation
    )));
  }, [activeId]);

  const ask = useCallback((rawPrompt: string) => {
    const prompt = rawPrompt.trim();
    if (!prompt || pending) return false;
    clearTimers();
    const now = Date.now();
    const plan = generateCoverReply(prompt);
    const conversationId = activeConversation?.id || newId("conversation");
    const model = activeConversation?.model || defaultModel;
    const userMessage: CoverMessage = {
      id: newId("question"),
      sender: "me",
      text: prompt,
      createdAt: now,
    };
    const baseConversation: CoverConversation = activeConversation || {
      id: conversationId,
      title: plan.title,
      updatedAt: now,
      model,
      messages: [],
    };
    const nextConversation = {
      ...baseConversation,
      title: baseConversation.messages.length ? baseConversation.title : plan.title,
      updatedAt: now,
      messages: [...baseConversation.messages, userMessage],
    };
    replaceConversation(nextConversation);

    const pendingReply: PendingReply = {
      conversationId,
      id: newId("answer"),
      fullText: plan.text,
      visibleText: "",
      createdAt: now + 1,
      phase: "thinking",
    };
    setPending(pendingReply);
    const timing = modelTiming(model);
    const thinkTimer = window.setTimeout(() => {
      timersRef.current.delete(thinkTimer);
      let visibleLength = 0;
      const stream = () => {
        visibleLength = Math.min(plan.text.length, visibleLength + timing.chunk);
        setPending((current) => current?.id === pendingReply.id ? {
          ...current,
          phase: "streaming",
          visibleText: plan.text.slice(0, visibleLength),
        } : current);
        if (visibleLength < plan.text.length) {
          const streamTimer = window.setTimeout(stream, plan.streamIntervalMs);
          timersRef.current.add(streamTimer);
          return;
        }
        setConversations((items) => items.map((conversation) => conversation.id === conversationId ? {
          ...conversation,
          updatedAt: Date.now(),
          messages: [...conversation.messages, {
            id: pendingReply.id,
            sender: "them",
            text: plan.text,
            createdAt: pendingReply.createdAt,
          }],
        } : conversation));
        setPending((current) => current?.id === pendingReply.id ? null : current);
      };
      stream();
    }, Math.round(plan.thinkingMs * timing.thinkingScale));
    timersRef.current.add(thinkTimer);
    return true;
  }, [activeConversation, clearTimers, defaultModel, pending, replaceConversation]);

  const activateEmergencyCover = useCallback(() => {
    clearTimers();
    setPending(null);
    const cover = selectEmergencyCover(conversations, Date.now(), Date.now());
    replaceConversation(cover);
    return cover;
  }, [clearTimers, conversations, replaceConversation]);

  return {
    conversations,
    activeConversation,
    activeId,
    messages,
    selectedModel,
    isResponding: Boolean(pending),
    ask,
    startNew,
    selectConversation,
    setModel,
    activateEmergencyCover,
  };
}
