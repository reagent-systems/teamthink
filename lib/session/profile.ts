const DISPLAY_NAME_KEY = "teamthink.displayName.v1";
const ROOM_OWNER_KEY = "teamthink.roomOwner.v1";

export type RoomRole = "owner" | "compute" | "request";

function canUseStorage(): boolean {
  return typeof window !== "undefined" && !!window.localStorage;
}

function readOwners(): Record<string, string> {
  if (!canUseStorage()) return {};
  try {
    return JSON.parse(localStorage.getItem(ROOM_OWNER_KEY) ?? "{}") as Record<
      string,
      string
    >;
  } catch {
    return {};
  }
}

function writeOwners(map: Record<string, string>): void {
  if (!canUseStorage()) return;
  localStorage.setItem(ROOM_OWNER_KEY, JSON.stringify(map));
}

/** Guest display name shown to other peers in the room. */
export function getDisplayName(): string {
  if (!canUseStorage()) return "";
  return localStorage.getItem(DISPLAY_NAME_KEY)?.trim() ?? "";
}

export function setDisplayName(name: string): void {
  if (!canUseStorage()) return;
  localStorage.setItem(DISPLAY_NAME_KEY, name.trim());
}

/**
 * First tab to open a room claims owner in localStorage. Returns whether this
 * peer is the room owner.
 */
export function resolveRoomRole(
  roomId: string,
  peerId: string,
  webgpu: boolean,
): RoomRole {
  const owners = readOwners();
  if (!owners[roomId]) {
    owners[roomId] = peerId;
    writeOwners(owners);
    return "owner";
  }
  if (owners[roomId] === peerId) return "owner";
  return webgpu ? "compute" : "request";
}

export function isRoomOwner(roomId: string, peerId: string): boolean {
  return readOwners()[roomId] === peerId;
}
