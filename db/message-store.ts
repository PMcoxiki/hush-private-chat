import { env } from "cloudflare:workers";

export function getMessageStore() {
  if (!env.DB) throw new Error("Cloudflare D1 binding `DB` is unavailable");
  return env.DB;
}

export async function ensureMessageSchema() {
  const database = getMessageStore();
  await database.batch([
    database.prepare(`CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      room TEXT NOT NULL,
      sender_id TEXT NOT NULL,
      cipher_text TEXT NOT NULL,
      iv TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )`),
    database.prepare("CREATE INDEX IF NOT EXISTS messages_room_time_idx ON messages(room, created_at)"),
    database.prepare(`CREATE TABLE IF NOT EXISTS messages_v3 (
      id TEXT PRIMARY KEY,
      room TEXT NOT NULL,
      cipher_text TEXT NOT NULL,
      iv TEXT NOT NULL
    )`),
    database.prepare("CREATE INDEX IF NOT EXISTS messages_v3_room_idx ON messages_v3(room)"),
  ]);
  return database;
}
