"use client";

import { useEffect } from "react";
import { ChatShell, type ChatShellProps } from "../shared/chat-shell";
import { deriveLegacyRoom, deriveRoom, generateSharedSecret } from "../shared/chat-crypto";
import { openDurableRoom } from "../shared/durable-room";

const openPrivateRoom: ChatShellProps["openPrivateRoom"] = async (secret, senderId, handlers) => {
  const [current, legacy] = await Promise.all([
    deriveRoom(secret),
    deriveLegacyRoom(secret),
  ]);
  return openDurableRoom({
    apiBase: "",
    room: current.room,
    key: current.key,
    senderId,
    legacy,
    onStatus: handlers.onStatus,
    onMessage: handlers.onMessage,
  });
};

export default function Home() {
  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);
  return <ChatShell createSharedSecret={generateSharedSecret} openPrivateRoom={openPrivateRoom} />;
}
