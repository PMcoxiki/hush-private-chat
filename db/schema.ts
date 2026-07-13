import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const messages = sqliteTable("messages", {
  id: text("id").primaryKey(),
  room: text("room").notNull(),
  senderId: text("sender_id").notNull(),
  cipherText: text("cipher_text").notNull(),
  iv: text("iv").notNull(),
  createdAt: integer("created_at").notNull(),
}, (table) => [index("messages_room_time_idx").on(table.room, table.createdAt)]);
