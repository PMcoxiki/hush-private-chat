const encoder = new TextEncoder();
const decoder = new TextDecoder();

export type ClearMessage = {
  senderId: string;
  text: string;
  createdAt: number;
};

export type CipherEnvelope = {
  v: 1;
  cipherText: string;
  iv: string;
};

function bytesToBase64(bytes: Uint8Array) {
  let value = "";
  bytes.forEach((byte) => (value += String.fromCharCode(byte)));
  return btoa(value);
}

function base64ToBytes(value: string) {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}

export async function deriveRoom(secret: string) {
  const source = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const material = new Uint8Array(await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: encoder.encode("hush-room-v3"),
      iterations: 600_000,
      hash: "SHA-256",
    },
    source,
    512,
  ));
  const key = await crypto.subtle.importKey(
    "raw",
    material.slice(0, 32),
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"],
  );
  const room = Array.from(material.slice(32))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 40);
  material.fill(0);
  return { key, room };
}

export async function encryptPayload(key: CryptoKey, payload: ClearMessage): Promise<CipherEnvelope> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const clear = encoder.encode(JSON.stringify(payload));
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, clear);
  clear.fill(0);
  return {
    v: 1,
    cipherText: bytesToBase64(new Uint8Array(cipher)),
    iv: bytesToBase64(iv),
  };
}

export async function decryptPayload(key: CryptoKey, envelope: CipherEnvelope): Promise<ClearMessage> {
  if (envelope.v !== 1 || !envelope.cipherText || !envelope.iv) {
    throw new Error("Unsupported encrypted message");
  }
  const clear = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(envelope.iv) },
    key,
    base64ToBytes(envelope.cipherText),
  );
  const parsed = JSON.parse(decoder.decode(clear)) as Partial<ClearMessage>;
  if (
    typeof parsed.senderId !== "string" ||
    typeof parsed.text !== "string" ||
    typeof parsed.createdAt !== "number" ||
    parsed.text.length > 20_000
  ) {
    throw new Error("Invalid encrypted message");
  }
  return parsed as ClearMessage;
}

export function generateSharedSecret() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return bytesToBase64(bytes)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}
