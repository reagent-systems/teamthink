/**
 * E2E encryption for mesh data channels (ROADMAP #74).
 * Room key derived from room id + optional user-supplied secret.
 */

const KEY_STORAGE = "teamthink.roomKeys.v1";

function readKeys(): Record<string, string> {
  if (typeof localStorage === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(KEY_STORAGE) ?? "{}") as Record<string, string>;
  } catch {
    return {};
  }
}

export function getRoomKey(roomId: string, secret?: string): string {
  if (secret?.trim()) return secret.trim();
  const keys = readKeys();
  if (keys[roomId]) return keys[roomId]!;
  const generated = `tt_${roomId}`;
  keys[roomId] = generated;
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(KEY_STORAGE, JSON.stringify(keys));
  }
  return generated;
}

export function setRoomSecret(roomId: string, secret: string): void {
  const keys = readKeys();
  keys[roomId] = secret.trim() || keys[roomId] || crypto.randomUUID().replace(/-/g, "");
  localStorage.setItem(KEY_STORAGE, JSON.stringify(keys));
}

async function deriveKey(roomKey: string): Promise<CryptoKey> {
  const raw = new TextEncoder().encode(roomKey.padEnd(32, "0").slice(0, 32));
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

export async function encryptFrame(
  roomId: string,
  payload: Uint8Array,
  secret?: string,
): Promise<Uint8Array> {
  const key = await deriveKey(getRoomKey(roomId, secret));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new Uint8Array(payload)),
  );
  const out = new Uint8Array(iv.length + cipher.length);
  out.set(iv, 0);
  out.set(cipher, iv.length);
  return out;
}

export async function decryptFrame(
  roomId: string,
  frame: Uint8Array,
  secret?: string,
): Promise<Uint8Array | null> {
  if (frame.length < 13) return frame;
  try {
    const key = await deriveKey(getRoomKey(roomId, secret));
    const iv = new Uint8Array(frame.subarray(0, 12));
    const cipherBytes = new Uint8Array(frame.subarray(12));
    const plain = new Uint8Array(
      await crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        key,
        cipherBytes,
      ),
    );
    return plain;
  } catch {
    return frame;
  }
}
