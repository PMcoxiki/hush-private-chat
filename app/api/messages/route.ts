import { ensureMessageSchema } from "../../../db/message-store";

const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type",
  "cache-control": "no-store",
};

const V2_ROOM = /^[a-f0-9]{32}$/;
const V3_ROOM = /^[a-f0-9]{40}$/;
const MESSAGE_ID = /^[a-f0-9]{32}$/;
const PAGE_SIZE = 200;
const MAX_BATCH_SIZE = 50;
const MAX_CIPHER_TEXT = 64_000;

type StoredEnvelope = {
  id?: string;
  cipherText?: string;
  iv?: string;
};

function json(body: unknown, init: ResponseInit = {}) {
  return Response.json(body, {
    ...init,
    headers: { ...CORS_HEADERS, ...init.headers },
  });
}

function validEnvelope(message: StoredEnvelope): message is Required<StoredEnvelope> {
  return MESSAGE_ID.test(message.id || "")
    && typeof message.cipherText === "string"
    && message.cipherText.length > 0
    && message.cipherText.length <= MAX_CIPHER_TEXT
    && typeof message.iv === "string"
    && message.iv.length > 0
    && message.iv.length <= 80;
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const room = url.searchParams.get("room") || "";

  if (V2_ROOM.test(room)) {
    const database = await ensureMessageSchema();
    const result = await database.prepare(`SELECT id, senderId, cipherText, iv, createdAt FROM (
      SELECT id, sender_id AS senderId, cipher_text AS cipherText, iv, created_at AS createdAt
      FROM messages WHERE room = ? ORDER BY created_at DESC LIMIT 300
    ) ORDER BY createdAt ASC`).bind(room).all();
    return json(result.results);
  }

  if (!V3_ROOM.test(room)) return json({ error: "Invalid room" }, { status: 400 });
  const before = url.searchParams.get("before") || "";
  if (before && !MESSAGE_ID.test(before)) return json({ error: "Invalid cursor" }, { status: 400 });
  const database = await ensureMessageSchema();

  const statement = before
    ? database.prepare(`SELECT id, cipher_text AS cipherText, iv FROM messages_v3
        WHERE room = ? AND rowid < (
          SELECT rowid FROM messages_v3 WHERE room = ? AND id = ?
        ) ORDER BY rowid DESC LIMIT ?`).bind(room, room, before, PAGE_SIZE + 1)
    : database.prepare(`SELECT id, cipher_text AS cipherText, iv FROM messages_v3
        WHERE room = ? ORDER BY rowid DESC LIMIT ?`).bind(room, PAGE_SIZE + 1);
  const result = await statement.all<Required<StoredEnvelope>>();
  const newestFirst = result.results || [];
  const hasMore = newestFirst.length > PAGE_SIZE;
  const messages = newestFirst.slice(0, PAGE_SIZE).reverse();
  return json({
    messages,
    nextBefore: hasMore && messages.length > 0 ? messages[0].id : null,
  });
}

export async function POST(request: Request) {
  let body: { room?: string; messages?: StoredEnvelope[] };
  try {
    body = await request.json() as typeof body;
  } catch {
    return json({ error: "Invalid JSON" }, { status: 400 });
  }

  const room = body.room || "";
  const messages = body.messages || [];
  if (
    !V3_ROOM.test(room)
    || !Array.isArray(messages)
    || messages.length === 0
    || messages.length > MAX_BATCH_SIZE
    || !messages.every(validEnvelope)
  ) {
    return json({ error: "Invalid message batch" }, { status: 400 });
  }

  const database = await ensureMessageSchema();
  await database.batch(messages.map((message) => (
    database.prepare(`INSERT OR IGNORE INTO messages_v3 (id, room, cipher_text, iv)
      VALUES (?, ?, ?, ?)`).bind(message.id, room, message.cipherText, message.iv)
  )));
  return json({ accepted: messages.length }, { status: 201 });
}
