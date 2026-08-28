import { WORKER_HTTP_URL } from "@/lib/config";
import { authHeaders } from "@/lib/auth/types";

export interface ApiKeyInfo {
  id: string;
  label: string;
  prefix: string;
  createdAt: number;
  lastUsedAt: number | null;
}

export interface QuotaInfo {
  usage: { tokens: number; scrapes: number; rooms: number; periodStart: number };
  limits: { tokens: number; scrapes: number; rooms: number };
}

export interface NotificationItem {
  id: string;
  kind: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: number;
}

export interface OrgInfo {
  id: string;
  name: string;
  ownerId: string;
  memberIds: string[];
  createdAt: number;
}

async function platformFetch<T>(path: string, init?: RequestInit): Promise<T> {
  if (!WORKER_HTTP_URL) throw new Error("Set NEXT_PUBLIC_SIGNAL_WS_URL");
  const res = await fetch(`${WORKER_HTTP_URL}${path}`, {
    ...init,
    headers: { ...authHeaders(), ...(init?.headers as Record<string, string>) },
  });
  const json = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
  return json;
}

export async function listApiKeys(): Promise<ApiKeyInfo[]> {
  const data = await platformFetch<{ keys: ApiKeyInfo[] }>("/api-keys");
  return data.keys;
}

export async function createApiKey(label?: string): Promise<{ key: ApiKeyInfo; secret: string }> {
  return platformFetch("/api-keys", {
    method: "POST",
    body: JSON.stringify({ label }),
  });
}

export async function revokeApiKey(keyId: string): Promise<void> {
  await platformFetch(`/api-keys/${keyId}`, { method: "DELETE" });
}

export async function fetchQuotas(): Promise<QuotaInfo> {
  return platformFetch("/quotas/me");
}

export async function consumeQuota(partial: {
  tokens?: number;
  scrapes?: number;
  rooms?: number;
}): Promise<QuotaInfo & { exceeded?: boolean }> {
  return platformFetch("/quotas/consume", {
    method: "POST",
    body: JSON.stringify(partial),
  });
}

export async function listNotifications(): Promise<NotificationItem[]> {
  const data = await platformFetch<{ notifications: NotificationItem[] }>("/notifications");
  return data.notifications;
}

export async function markNotificationsRead(ids?: string[]): Promise<void> {
  await platformFetch("/notifications/read", {
    method: "POST",
    body: JSON.stringify({ ids }),
  });
}

export async function createOrg(name: string): Promise<OrgInfo> {
  const data = await platformFetch<{ org: OrgInfo }>("/orgs", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
  return data.org;
}

export async function uploadArtifact(
  name: string,
  data: ArrayBuffer,
  contentType: string,
): Promise<{ id: string; url: string }> {
  const b64 = btoa(String.fromCharCode(...new Uint8Array(data)));
  return platformFetch("/artifacts", {
    method: "POST",
    body: JSON.stringify({ name, contentType, data: b64 }),
  });
}

export async function listAuditLog(): Promise<
  { id: string; at: number; actorId: string; action: string; target: string }[]
> {
  const data = await platformFetch<{
    entries: { id: string; at: number; actorId: string; action: string; target: string }[];
  }>("/audit");
  return data.entries;
}

const GATEWAY_KEYS_KEY = "teamthink.gatewayKeys.v1";

export function getLocalGatewayKeys(): string[] {
  if (typeof localStorage === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(GATEWAY_KEYS_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}

export function addLocalGatewayKey(secret: string): void {
  const keys = getLocalGatewayKeys();
  if (!keys.includes(secret)) {
    keys.push(secret);
    localStorage.setItem(GATEWAY_KEYS_KEY, JSON.stringify(keys));
  }
}

export function validateGatewayKey(provided: string | null): boolean {
  if (!provided) return getLocalGatewayKeys().length === 0;
  return getLocalGatewayKeys().includes(provided);
}
