import {
  decryptLegacyMessage,
  decryptPayload,
  encryptPayload,
  legacyMessageId,
  type CipherEnvelope,
  type ClearMessage,
} from "./chat-crypto.ts";

export const DURABLE_API_BASE = "https://hush-private-ai.coxiki.chatgpt.site";

export type ConnectionStatus = "connecting" | "online" | "offline";

export type RoomMessage = ClearMessage & {
  id: string;
  historical?: boolean;
};

export type StoredEnvelope = CipherEnvelope & {
  id: string;
};

type LegacyRoom = {
  room: string;
  key: CryptoKey;
};

type LegacyRow = {
  id: string;
  senderId: string;
  cipherText: string;
  iv: string;
  createdAt: number;
};

type HistoryPage = {
  messages: StoredEnvelope[];
  nextBefore: string | null;
};

type DurableRoomOptions = {
  apiBase?: string;
  room: string;
  key: CryptoKey;
  senderId: string;
  legacy?: LegacyRoom;
  onMessage: (message: RoomMessage) => void;
  onStatus: (status: ConnectionStatus) => void;
  fetcher?: typeof fetch;
  pollIntervalMs?: number;
  requestTimeoutMs?: number;
};

export type DurableRoomTransport = {
  send: (text: string) => Promise<RoomMessage>;
  persist: (message: RoomMessage, envelope: CipherEnvelope) => Promise<void>;
  sync: () => Promise<void>;
  close: () => void;
};

const MESSAGE_ID_PATTERN = /^[a-f0-9]{32}$/;

function messageId() {
  return crypto.randomUUID().replaceAll("-", "");
}

function endpoint(apiBase: string) {
  const normalized = apiBase.replace(/\/$/, "");
  return `${normalized}/api/messages`;
}

function isStoredEnvelope(value: unknown): value is StoredEnvelope {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<StoredEnvelope>;
  return MESSAGE_ID_PATTERN.test(row.id || "")
    && typeof row.cipherText === "string"
    && typeof row.iv === "string";
}

function isLegacyRow(value: unknown): value is LegacyRow {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<LegacyRow>;
  return typeof row.id === "string"
    && typeof row.senderId === "string"
    && typeof row.cipherText === "string"
    && typeof row.iv === "string"
    && typeof row.createdAt === "number";
}

export function openDurableRoom(options: DurableRoomOptions): DurableRoomTransport {
  const apiBase = options.apiBase ?? DURABLE_API_BASE;
  const fetcher = options.fetcher ?? globalThis.fetch.bind(globalThis);
  const pollIntervalMs = options.pollIntervalMs ?? 2_500;
  const requestTimeoutMs = options.requestTimeoutMs ?? 10_000;
  const pendingRequests = new Set<AbortController>();
  const delivered = new Set<string>();
  let active = true;
  let initialSyncComplete = false;
  let syncing: Promise<void> | null = null;

  const request = async (url: string, init?: RequestInit) => {
    const controller = new AbortController();
    const timeout = globalThis.setTimeout(() => controller.abort(), requestTimeoutMs);
    pendingRequests.add(controller);
    try {
      return await fetcher(url, { ...init, signal: controller.signal });
    } finally {
      globalThis.clearTimeout(timeout);
      pendingRequests.delete(controller);
    }
  };

  const emitEnvelope = async (row: StoredEnvelope, historical: boolean) => {
    if (!active || delivered.has(row.id)) return;
    const clear = await decryptPayload(options.key, {
      v: 1,
      cipherText: row.cipherText,
      iv: row.iv,
    });
    if (!active) return;
    delivered.add(row.id);
    options.onMessage({ id: row.id, ...clear, historical });
  };

  const persistRows = async (rows: StoredEnvelope[]) => {
    if (!active) throw new Error("Room closed");
    for (let offset = 0; offset < rows.length; offset += 50) {
      const batch = rows.slice(offset, offset + 50);
      const response = await request(endpoint(apiBase), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          room: options.room,
          messages: batch.map(({ id, cipherText, iv }) => ({ id, cipherText, iv })),
        }),
      });
      if (!response.ok || !active) throw new Error("Durable relay rejected the message");
    }
  };

  const sync = () => {
    if (!active) return Promise.resolve();
    if (syncing) return syncing;
    syncing = (async () => {
      const historical = !initialSyncComplete;
      let before = "";
      do {
        const query = new URLSearchParams({ room: options.room });
        if (before) query.set("before", before);
        const response = await request(`${endpoint(apiBase)}?${query.toString()}`, { cache: "no-store" });
        if (!response.ok || !active) throw new Error("Durable relay is unavailable");
        const page = await response.json() as Partial<HistoryPage>;
        const rows = Array.isArray(page.messages) ? page.messages.filter(isStoredEnvelope) : [];
        await Promise.all(rows.map((row) => emitEnvelope(row, historical)));
        options.onStatus("online");
        before = typeof page.nextBefore === "string" ? page.nextBefore : "";
      } while (active && before);
      initialSyncComplete = true;
    })().catch(() => {
      if (active) options.onStatus("offline");
    }).finally(() => {
      syncing = null;
    });
    return syncing;
  };

  const migrateLegacy = async () => {
    if (!active || !options.legacy) return;
    try {
      const query = new URLSearchParams({ room: options.legacy.room });
      const response = await request(`${endpoint(apiBase)}?${query.toString()}`, { cache: "no-store" });
      if (!response.ok || !active) return;
      const payload = await response.json() as unknown;
      const legacyRows = Array.isArray(payload) ? payload.filter(isLegacyRow) : [];
      const migrated = await Promise.all(legacyRows.map(async (row): Promise<StoredEnvelope> => {
        const text = await decryptLegacyMessage(options.legacy!.key, row.cipherText, row.iv);
        const clear: ClearMessage = {
          senderId: row.senderId,
          text,
          createdAt: row.createdAt,
        };
        const [id, encrypted] = await Promise.all([
          legacyMessageId(row.id),
          encryptPayload(options.key, clear),
        ]);
        return { id, ...encrypted };
      }));
      if (!active || migrated.length === 0) return;
      await persistRows(migrated);
      await Promise.all(migrated.map((row) => emitEnvelope(row, true)));
    } catch {
      // Legacy recovery is best-effort and never blocks the current room.
    }
  };

  options.onStatus("connecting");
  void Promise.allSettled([sync(), migrateLegacy()]);
  const timer = globalThis.setInterval(() => void sync(), pollIntervalMs);

  return {
    async send(text) {
      if (!active) throw new Error("Room closed");
      const message: RoomMessage = {
        id: messageId(),
        senderId: options.senderId,
        text,
        createdAt: Date.now(),
      };
      const envelope = await encryptPayload(options.key, message);
      await persistRows([{ id: message.id, ...envelope }]);
      return message;
    },
    async persist(message, envelope) {
      await persistRows([{ id: message.id, ...envelope }]);
    },
    sync,
    close() {
      active = false;
      globalThis.clearInterval(timer);
      for (const controller of pendingRequests) controller.abort();
      pendingRequests.clear();
    },
  };
}
