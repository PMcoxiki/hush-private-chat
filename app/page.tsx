"use client";

import { useEffect } from "react";
import { ChatShell, type ChatShellProps, type PrivateMessage } from "../shared/chat-shell";
import { decryptMessage, deriveRoom, encryptMessage, generateSharedSecret } from "./lib/chat-crypto";

type ApiMessage = {
  id: string;
  senderId: string;
  cipherText: string;
  iv: string;
  createdAt: number;
};

const openPrivateRoom: ChatShellProps["openPrivateRoom"] = async (secret, senderId, handlers) => {
  const derived = await deriveRoom(secret);
  let active = true;
  let timer = 0;

  const sync = async () => {
    try {
      const response = await fetch(`/api/messages?room=${derived.room}`, { cache: "no-store" });
      if (!response.ok || !active) throw new Error("Unavailable");
      const rows = (await response.json()) as ApiMessage[];
      const decoded = await Promise.all(rows.map(async (row): Promise<PrivateMessage | null> => {
        try {
          return {
            id: row.id,
            senderId: row.senderId,
            text: await decryptMessage(derived.key, row.cipherText, row.iv),
            createdAt: row.createdAt,
          };
        } catch {
          return null;
        }
      }));
      if (!active) return;
      for (const message of decoded) {
        if (message) handlers.onMessage(message);
      }
      handlers.onStatus("online");
    } catch {
      if (active) handlers.onStatus("offline");
    }
  };

  void sync();
  timer = window.setInterval(sync, 2_500);

  return {
    close: () => {
      active = false;
      window.clearInterval(timer);
    },
    send: async (text) => {
      const encrypted = await encryptMessage(derived.key, text);
      const response = await fetch("/api/messages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          room: derived.room,
          senderId,
          cipherText: encrypted.cipherText,
          iv: encrypted.iv,
        }),
      });
      if (!response.ok) throw new Error("Message rejected");
      const result = (await response.json()) as { id: string; createdAt: number };
      return { id: result.id, senderId, text, createdAt: result.createdAt };
    },
  };
};

export default function Home() {
  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);
  return <ChatShell createSharedSecret={generateSharedSecret} openPrivateRoom={openPrivateRoom} />;
}
