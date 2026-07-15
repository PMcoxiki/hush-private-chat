const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function bytesToBase64(bytes: Uint8Array) {
  let value = "";
  bytes.forEach((byte) => (value += String.fromCharCode(byte)));
  return btoa(value);
}

export function base64ToBytes(value: string) {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}

export async function deriveRoom(secret: string) {
  const source = await crypto.subtle.importKey("raw", encoder.encode(secret), "PBKDF2", false, ["deriveBits"]);
  const material = new Uint8Array(await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: encoder.encode("hush-room-v2"), iterations: 600_000, hash: "SHA-256" },
    source,
    512,
  ));
  const key = await crypto.subtle.importKey("raw", material.slice(0, 32), { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
  const room = Array.from(material.slice(32)).map((byte) => byte.toString(16).padStart(2, "0")).join("").slice(0, 32);
  material.fill(0);
  return { key, room };
}

export async function encryptMessage(key: CryptoKey, text: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(text));
  return { cipherText: bytesToBase64(new Uint8Array(cipher)), iv: bytesToBase64(iv) };
}

export async function decryptMessage(key: CryptoKey, cipherText: string, iv: string) {
  const clear = await crypto.subtle.decrypt({ name: "AES-GCM", iv: base64ToBytes(iv) }, key, base64ToBytes(cipherText));
  return decoder.decode(clear);
}

export function generateSharedSecret() {
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  return bytesToBase64(bytes).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}
