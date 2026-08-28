import { WORKER_HTTP_URL } from "@/lib/config";
import { authHeaders } from "@/lib/auth/types";
import { listThreads, saveThread } from "@/lib/chat/storage";
import type { ChatThread } from "@/lib/chat/types";
import {
  cacheThreads,
  cacheYjsSnapshot,
  loadCachedThreads,
  loadYjsSnapshot,
} from "@/lib/persistence/idb";

const SYNC_INTERVAL_MS = 30_000;

export interface RoomStateRemote {
  yjsSnapshot?: string;
  threads?: ChatThread[];
  updatedAt: number;
}

async function platformFetch<T>(path: string, init?: RequestInit): Promise<T> {
  if (!WORKER_HTTP_URL) throw new Error("no worker url");
  const res = await fetch(`${WORKER_HTTP_URL}${path}`, {
    ...init,
    headers: { ...authHeaders(), ...(init?.headers as Record<string, string>) },
  });
  const json = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
  return json;
}

export async function pullRoomState(roomId: string): Promise<RoomStateRemote | null> {
  try {
    const state = await platformFetch<RoomStateRemote>(`/rooms/${roomId}/state`);
    if (state.threads) {
      await cacheThreads(roomId, state.threads);
      for (const t of state.threads) {
        if (t.roomId === roomId) saveThread(t);
      }
    }
    if (state.yjsSnapshot) {
      const bytes = Uint8Array.from(atob(state.yjsSnapshot), (c) => c.charCodeAt(0));
      await cacheYjsSnapshot(roomId, bytes);
    }
    return state;
  } catch {
    const cached = await loadCachedThreads(roomId);
    return cached ? { threads: cached as ChatThread[], updatedAt: Date.now() } : null;
  }
}

export async function pushRoomState(
  roomId: string,
  yjsSnapshot?: Uint8Array,
): Promise<void> {
  const threads = listThreads(roomId);
  const body: Record<string, unknown> = {
    threads,
    updatedAt: Date.now(),
  };
  if (yjsSnapshot) {
    body.yjsSnapshot = btoa(String.fromCharCode(...yjsSnapshot));
    await cacheYjsSnapshot(roomId, yjsSnapshot);
  }
  await cacheThreads(roomId, threads);
  try {
    await platformFetch(`/rooms/${roomId}/state`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
  } catch {
    // offline — local cache only
  }
}

export async function loadOfflineYjs(roomId: string): Promise<Uint8Array | null> {
  return loadYjsSnapshot(roomId);
}

let syncTimer: ReturnType<typeof setInterval> | null = null;

export function startRoomSync(roomId: string, getSnapshot: () => Uint8Array | null): () => void {
  void pullRoomState(roomId);
  syncTimer = setInterval(() => {
    const snap = getSnapshot();
    void pushRoomState(roomId, snap ?? undefined);
  }, SYNC_INTERVAL_MS);
  return () => {
    if (syncTimer) clearInterval(syncTimer);
    syncTimer = null;
  };
}
