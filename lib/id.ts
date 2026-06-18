const ROOM_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

/** Short, URL-friendly room code (no ambiguous separators). */
export function generateRoomId(length = 8): string {
  let out = "";
  const bytes = new Uint8Array(length);
  cryptoSource().getRandomValues(bytes);
  for (let i = 0; i < length; i++) {
    out += ROOM_ALPHABET[bytes[i] % ROOM_ALPHABET.length];
  }
  return out;
}

/** Per-tab peer id. Random and reasonably unique for a session. */
export function generatePeerId(): string {
  return `p_${cryptoSource().randomUUID().replace(/-/g, "").slice(0, 16)}`;
}

function cryptoSource(): Crypto {
  if (typeof globalThis.crypto !== "undefined") return globalThis.crypto;
  throw new Error("Web Crypto API is unavailable in this environment");
}
