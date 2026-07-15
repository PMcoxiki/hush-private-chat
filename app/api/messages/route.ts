import { env } from "cloudflare:workers";

async function ensureSchema() {
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    room TEXT NOT NULL,
    sender_id TEXT NOT NULL,
    cipher_text TEXT NOT NULL,
    iv TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )`).run();
  await env.DB.prepare("CREATE INDEX IF NOT EXISTS messages_room_time_idx ON messages(room, created_at)").run();
}

export async function GET(request: Request) {
  const room = new URL(request.url).searchParams.get("room") || "";
  if (!/^[a-f0-9]{32}$/.test(room)) return Response.json({ error: "Invalid room" }, { status: 400 });
  await ensureSchema();
  const result = await env.DB.prepare("SELECT id, sender_id AS senderId, cipher_text AS cipherText, iv, created_at AS createdAt FROM messages WHERE room = ? ORDER BY created_at ASC LIMIT 300").bind(room).all();
  return Response.json(result.results, { headers: { "cache-control": "no-store" } });
}

export async function POST(request: Request) {
  const body = await request.json() as { room?: string; senderId?: string; cipherText?: string; iv?: string };
  if (!body.room || !/^[a-f0-9]{32}$/.test(body.room) || !body.senderId || !body.cipherText || !body.iv || body.cipherText.length > 16000) {
    return Response.json({ error: "Invalid message" }, { status: 400 });
  }
  await ensureSchema();
  const id = crypto.randomUUID();
  const createdAt = Date.now();
  await env.DB.prepare("INSERT INTO messages (id, room, sender_id, cipher_text, iv, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(id, body.room, body.senderId.slice(0, 80), body.cipherText, body.iv.slice(0, 80), createdAt).run();
  return Response.json({ id, createdAt }, { status: 201 });
}
