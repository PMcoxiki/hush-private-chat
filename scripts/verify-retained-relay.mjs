import assert from "node:assert/strict";
import mqtt from "mqtt";
import {
  decryptPayload,
  deriveRoom,
  encryptPayload,
  generateSharedSecret,
  SHARED_CODE_LENGTH,
} from "../fallback/src/chat-crypto.ts";

const brokers = [
  "wss://broker.emqx.io:8084/mqtt",
  "wss://broker.hivemq.com:8884/mqtt",
];

function connect(url) {
  return mqtt.connect(url, {
    clean: true,
    connectTimeout: 10_000,
    keepalive: 30,
    reconnectPeriod: 0,
    clientId: `hush_verify_${crypto.randomUUID().replaceAll("-", "").slice(0, 20)}`,
  });
}

function waitForConnect(client) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Relay connection timed out")), 12_000);
    client.once("connect", () => {
      clearTimeout(timer);
      resolve();
    });
    client.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

function publish(client, topic, payload, retain) {
  return new Promise((resolve, reject) => {
    client.publish(topic, payload, { qos: 1, retain }, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

function subscribe(client, topic) {
  return new Promise((resolve, reject) => {
    client.subscribe(topic, { qos: 1 }, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

function close(client) {
  if (!client) return Promise.resolve();
  return new Promise((resolve) => client.end(true, {}, resolve));
}

async function verifyBroker(broker) {
  const secret = generateSharedSecret();
  assert.equal(secret.length, SHARED_CODE_LENGTH);
  const publisherRoom = await deriveRoom(secret);
  const receiverRoom = await deriveRoom(secret);
  assert.equal(publisherRoom.room, receiverRoom.room);

  const marker = crypto.randomUUID().replaceAll("-", "");
  const clear = {
    senderId: `device-a-${marker.slice(0, 8)}`,
    text: `relay-check-${marker}`,
    createdAt: Date.now(),
  };
  const messageId = crypto.randomUUID().replaceAll("-", "");
  const topicBase = `hush/v3/${publisherRoom.room}`;
  const topic = `${topicBase}/${messageId}`;
  const envelope = await encryptPayload(publisherRoom.key, clear);
  const serialized = JSON.stringify(envelope);
  assert.equal(serialized.includes(clear.text), false);
  assert.equal(serialized.includes(clear.senderId), false);

  let publisher;
  let receiver;
  try {
    publisher = connect(broker);
    await waitForConnect(publisher);
    await publish(publisher, topic, serialized, true);
    await close(publisher);
    publisher = undefined;

    receiver = connect(broker);
    await waitForConnect(receiver);
    const received = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Retained ciphertext was not delivered")), 12_000);
      receiver.on("message", async (receivedTopic, payload, packet) => {
        if (receivedTopic !== topic) return;
        try {
          const decoded = await decryptPayload(receiverRoom.key, JSON.parse(payload.toString("utf8")));
          clearTimeout(timer);
          resolve({ decoded, retained: packet.retain });
        } catch (error) {
          clearTimeout(timer);
          reject(error);
        }
      });
    });
    await subscribe(receiver, `${topicBase}/+`);
    const result = await received;
    assert.deepEqual(result.decoded, clear);
    assert.equal(result.retained, true);

    await publish(receiver, topic, "", true);
    return {
      broker,
      independentClients: true,
      retainedHistory: true,
      decrypted: true,
      plaintextInEnvelope: false,
      cleanedUp: true,
    };
  } finally {
    await Promise.allSettled([close(publisher), close(receiver)]);
  }
}

let lastError;
for (const broker of brokers) {
  try {
    console.log(JSON.stringify(await verifyBroker(broker)));
    process.exit(0);
  } catch (error) {
    lastError = error;
  }
}

throw lastError ?? new Error("No relay was available");
