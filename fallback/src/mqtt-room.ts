import mqtt from "mqtt";
import type { MqttClient } from "mqtt";
import {
  decryptPayload,
  encryptPayload,
  type CipherEnvelope,
  type ClearMessage,
} from "./chat-crypto";

export type ConnectionStatus = "connecting" | "online" | "offline";

export type RoomMessage = ClearMessage & {
  id: string;
  historical?: boolean;
};

type RoomOptions = {
  room: string;
  key: CryptoKey;
  senderId: string;
  onMessage: (message: RoomMessage) => void;
  onStatus: (status: ConnectionStatus) => void;
};

export type RoomTransport = {
  send: (text: string) => Promise<RoomMessage>;
  close: () => void;
};

const MAX_ENVELOPE_BYTES = 64_000;

function messageId() {
  return crypto.randomUUID().replaceAll("-", "");
}

function createClient() {
  return mqtt.connect({
    protocol: "wss",
    path: "/mqtt",
    clean: true,
    keepalive: 45,
    reconnectPeriod: 2_500,
    connectTimeout: 10_000,
    clientId: `hush_web_${messageId().slice(0, 20)}`,
    servers: [
      { host: "broker.emqx.io", port: 8084, protocol: "wss" },
      { host: "broker.hivemq.com", port: 8884, protocol: "wss" },
    ],
  });
}

export function openRoom(options: RoomOptions): RoomTransport {
  const topicBase = `hush/v3/${options.room}`;
  const topicFilter = `${topicBase}/+`;
  const client: MqttClient = createClient();
  let closed = false;

  options.onStatus("connecting");

  client.on("connect", () => {
    if (closed) return;
    client.subscribe(topicFilter, { qos: 1 }, (error) => {
      options.onStatus(error ? "offline" : "online");
    });
  });

  client.on("reconnect", () => {
    if (!closed) options.onStatus("connecting");
  });

  client.on("offline", () => {
    if (!closed) options.onStatus("offline");
  });

  client.on("close", () => {
    if (!closed) options.onStatus("offline");
  });

  client.on("message", async (topic, payload, packet) => {
    if (closed || !topic.startsWith(`${topicBase}/`) || payload.byteLength > MAX_ENVELOPE_BYTES) return;
    const id = topic.slice(topicBase.length + 1);
    if (!/^[a-f0-9]{32}$/.test(id)) return;
    try {
      const envelope = JSON.parse(payload.toString("utf8")) as CipherEnvelope;
      const clear = await decryptPayload(options.key, envelope);
      options.onMessage({ id, ...clear, historical: packet.retain });
    } catch {
      // Ignore malformed traffic and ciphertext from callers without this room key.
    }
  });

  return {
    async send(text) {
      if (closed || !client.connected) throw new Error("Secure relay is offline");
      const message: RoomMessage = {
        id: messageId(),
        senderId: options.senderId,
        text,
        createdAt: Date.now(),
      };
      const envelope = await encryptPayload(options.key, message);
      if (closed || !client.connected) throw new Error("Secure relay is offline");
      const topic = `${topicBase}/${message.id}`;
      await new Promise<void>((resolve, reject) => {
        client.publish(topic, JSON.stringify(envelope), { qos: 1, retain: true }, (error) => {
          if (error) reject(error);
          else resolve();
        });
      });
      return message;
    },
    close() {
      closed = true;
      client.end(true);
    },
  };
}
