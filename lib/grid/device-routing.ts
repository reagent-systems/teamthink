/** LM Link–style preferred device routing (ROADMAP #72). */

const PREFERRED_PEER_KEY = "teamthink.preferredPeer.v1";
const DEVICE_LABEL_KEY = "teamthink.deviceLabel.v1";

export function getDeviceLabel(): string {
  if (typeof localStorage === "undefined") return "";
  return localStorage.getItem(DEVICE_LABEL_KEY)?.trim() ?? "";
}

export function setDeviceLabel(label: string): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(DEVICE_LABEL_KEY, label.trim());
}

export function getPreferredPeer(roomId: string): string | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const map = JSON.parse(
      localStorage.getItem(PREFERRED_PEER_KEY) ?? "{}",
    ) as Record<string, string>;
    return map[roomId] ?? null;
  } catch {
    return null;
  }
}

export function setPreferredPeer(roomId: string, peerId: string | null): void {
  if (typeof localStorage === "undefined") return;
  const map = JSON.parse(
    localStorage.getItem(PREFERRED_PEER_KEY) ?? "{}",
  ) as Record<string, string>;
  if (peerId) map[roomId] = peerId;
  else delete map[roomId];
  localStorage.setItem(PREFERRED_PEER_KEY, JSON.stringify(map));
}
