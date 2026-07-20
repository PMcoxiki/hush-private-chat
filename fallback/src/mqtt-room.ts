import mqtt from "mqtt";
import type { MqttClient } from "mqtt";
import {
  decryptPayload,
  encryptPayload,
  type CipherEnvelope,
} from "./chat-crypto";
import {
  openDurableRoom,
  type ConnectionStatus,
  type RoomMessage,
} from "../../shared/durable-room";

type RoomOptions = {
  room: string;
  key: CryptoKey;
  senderId: string;
  legacy: { room: string; key: CryptoKey };
  onMessage: (message: RoomMessage) => void;
  onStatus: (status: ConnectionStatus) => void;
};

export type RoomTransport = {
  send: (text: string) => Promise<RoomMessage>;
  close: () => void;
};

const MAX_ENVELOPE_BYTES = 64_000;
const MQTT_RETAIN_HISTORY = true;
const BROKERS = [
  "wss://broker.emqx.io:8084/mqtt",
  "wss://broker.hivemq.com:8884/mqtt",
] as const;

function messageId() {
  return crypto.randomUUID().replaceAll("-", "");
}

function createClient(broker: string) {
  return mqtt.connect(broker, {
    clean: true,
    keepalive: 45,
    reconnectPeriod: 5_000,
    connectTimeout: 10_000,
    clientId: `hush_web_${messageId().slice(0, 20)}`,
  });
}

function publish(client: MqttClient, topic: string, payload: string, retain: boolean) {
  return new Promise<void>((resolve, reject) => {
    client.publish(topic, payload, { qos: 1, retain }, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

function publishWhenConnected(client: MqttClient, topic: string, payload: string, retain: boolean) {
  return new Promise<void>((resolve, reject) => {
    if (client.connected) {
      void publish(client, topic, payload, retain).then(resolve, reject);
      return;
    }

    const timer = globalThis.setTimeout(() => {
      cleanup();
      reject(new Error("MQTT relay connection timed out"));
    }, 12_000);
    function cleanup() {
      globalThis.clearTimeout(timer);
      client.off("connect", attempt);
    }
    function attempt() {
      cleanup();
      void publish(client, topic, payload, retain).then(resolve, reject);
    }

    client.once("connect", attempt);
  });
}

export async function openRoom(options: RoomOptions): Promise<RoomTransport> {
  const topicBase = `hush/v3/${options.room}`;
  const topicFilter = `${topicBase}/+`;
  const clients = BROKERS.map(createClient);
  let closed = false;
  let durableStatus: ConnectionStatus = "connecting";

  const updateStatus = () => {
    if (closed) return;
    if (durableStatus === "online" || clients.some((client) => client.connected)) {
      options.onStatus("online");
    } else if (durableStatus === "connecting" || clients.some((client) => client.reconnecting)) {
      options.onStatus("connecting");
    } else {
      options.onStatus("offline");
    }
  };

  const durable = openDurableRoom({
    room: options.room,
    key: options.key,
    senderId: options.senderId,
    legacy: options.legacy,
    onMessage: options.onMessage,
    onStatus: (status) => {
      durableStatus = status;
      updateStatus();
    },
  });

  const handleMessage = async (topic: string, payload: Uint8Array, retained: boolean) => {
    if (closed || !topic.startsWith(`${topicBase}/`) || payload.byteLength > MAX_ENVELOPE_BYTES) return;
    const id = topic.slice(topicBase.length + 1);
    if (!/^[a-f0-9]{32}$/.test(id)) return;
    try {
      const envelope = JSON.parse(new TextDecoder().decode(payload)) as CipherEnvelope;
      const clear = await decryptPayload(options.key, envelope);
      const message = { id, ...clear, historical: retained };
      options.onMessage(message);
      if (retained) void durable.persist(message, envelope).catch(() => undefined);
    } catch {
      // Ignore malformed traffic and ciphertext from callers without this room key.
    }
  };

  for (const client of clients) {
    client.on("connect", () => {
      if (closed) return;
      client.subscribe(topicFilter, { qos: 1 }, updateStatus);
    });
    client.on("reconnect", updateStatus);
    client.on("offline", updateStatus);
    client.on("close", updateStatus);
    client.on("error", updateStatus);
    client.on("message", (topic, payload, packet) => {
      void handleMessage(topic, payload, packet.retain);
    });
  }

  options.onStatus("connecting");

  return {
    async send(text) {
      if (closed) throw new Error("Secure relay is offline");
      const message: RoomMessage = {
        id: messageId(),
        senderId: options.senderId,
        text,
        createdAt: Date.now(),
      };
      const envelope = await encryptPayload(options.key, message);
      const durableAttempt = durable.persist(message, envelope);
      const brokerAttempt = Promise.any(clients.map((client) => (
        publishWhenConnected(
          client,
          `${topicBase}/${message.id}`,
          JSON.stringify(envelope),
          MQTT_RETAIN_HISTORY,
        )
      )));

      try {
        await Promise.any([durableAttempt, brokerAttempt]);
      } catch {
        throw new Error("Secure relay is offline");
      }
      return message;
    },
    close() {
      closed = true;
      durable.close();
      for (const client of clients) client.end(true);
    },
  };
}
