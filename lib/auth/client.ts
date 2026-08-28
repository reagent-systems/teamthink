import { WORKER_HTTP_URL } from "@/lib/config";
import {
  authHeaders,
  clearSession,
  getStoredUser,
  storeSession,
  type AuthSession,
  type AuthUser,
} from "@/lib/auth/types";

type Listener = (user: AuthUser | null) => void;
const listeners = new Set<Listener>();

function emit(user: AuthUser | null): void {
  for (const l of listeners) l(user);
}

async function platformFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  if (!WORKER_HTTP_URL) {
    throw new Error("Set NEXT_PUBLIC_SIGNAL_WS_URL to enable platform features");
  }
  const res = await fetch(`${WORKER_HTTP_URL}${path}`, {
    ...init,
    headers: { ...authHeaders(), ...(init?.headers as Record<string, string>) },
  });
  const json = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
  return json;
}

export function onAuthStateChanged(fn: Listener): () => void {
  listeners.add(fn);
  fn(getStoredUser());
  return () => listeners.delete(fn);
}

export async function signInAnonymous(displayName?: string): Promise<AuthSession> {
  const data = await platformFetch<{ token: string; user: AuthUser }>(
    "/auth/anonymous",
    { method: "POST", body: JSON.stringify({ displayName }) },
  );
  const session = { token: data.token, user: data.user };
  storeSession(session);
  emit(session.user);
  return session;
}

export async function signInMagicLink(email: string): Promise<AuthSession> {
  const data = await platformFetch<{ token: string; user: AuthUser }>(
    "/auth/magic-link",
    { method: "POST", body: JSON.stringify({ email }) },
  );
  const session = { token: data.token, user: data.user };
  storeSession(session);
  emit(session.user);
  return session;
}

export async function signInOAuth(
  provider: "google" | "github",
  code: string,
  profile?: { email?: string; displayName?: string },
): Promise<AuthSession> {
  const data = await platformFetch<{ token: string; user: AuthUser }>(
    "/auth/oauth",
    {
      method: "POST",
      body: JSON.stringify({ provider, code, ...profile }),
    },
  );
  const session = { token: data.token, user: data.user };
  storeSession(session);
  emit(session.user);
  return session;
}

export async function upgradeAnonymous(email: string): Promise<AuthSession> {
  const data = await platformFetch<{ token: string; user: AuthUser }>(
    "/auth/upgrade",
    { method: "POST", body: JSON.stringify({ email }) },
  );
  const session = { token: data.token, user: data.user };
  storeSession(session);
  emit(session.user);
  return session;
}

export function signOut(): void {
  clearSession();
  emit(null);
}

export async function ensureAuth(displayName?: string): Promise<AuthUser> {
  const existing = getStoredUser();
  if (existing) return existing;
  const session = await signInAnonymous(displayName);
  return session.user;
}

export async function refreshMe(): Promise<AuthUser | null> {
  try {
    const data = await platformFetch<{ user: AuthUser }>("/auth/me");
    storeSession({ token: (await import("@/lib/auth/types")).getStoredToken()!, user: data.user });
    emit(data.user);
    return data.user;
  } catch {
    return getStoredUser();
  }
}

export async function joinRoom(
  roomId: string,
  opts?: { role?: string; compute?: boolean },
): Promise<{ role: string; compute: boolean }> {
  const data = await platformFetch<{ member: { role: string; compute: boolean } }>(
    `/rooms/${roomId}/members`,
    { method: "POST", body: JSON.stringify(opts ?? {}) },
  );
  return { role: data.member.role, compute: data.member.compute };
}

export async function fetchRoomMembers(roomId: string): Promise<
  { userId: string; role: string; displayName?: string; compute: boolean }[]
> {
  const data = await platformFetch<{ members: { userId: string; role: string; displayName?: string; compute: boolean }[] }>(
    `/rooms/${roomId}/members`,
  );
  return data.members;
}

export async function fetchServerPresence(roomId: string): Promise<
  { peer: string; at: number }[]
> {
  const data = await platformFetch<{ peers: { peer: string; at: number }[] }>(
    `/rooms/${roomId}/presence`,
  );
  return data.peers ?? [];
}

export async function triggerRoomCreated(roomId: string, userId: string): Promise<void> {
  await platformFetch("/triggers/room-created", {
    method: "POST",
    body: JSON.stringify({ roomId, userId }),
  });
}
