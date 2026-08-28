/**
 * Platform helpers: token auth, App Check, rate limits, audit events.
 * Lightweight JWT-like tokens (base64url payload + HMAC) — no external deps.
 */

export interface AuthUser {
  id: string;
  email: string | null;
  displayName: string;
  provider: "anonymous" | "magic" | "google" | "github";
  createdAt: number;
}

export interface RoomMember {
  userId: string;
  role: "owner" | "admin" | "member" | "viewer";
  compute: boolean;
  joinedAt: number;
}

export interface RoomStatePayload {
  yjsSnapshot?: string;
  threads?: unknown;
  updatedAt: number;
}

export interface RemoteConfigPayload {
  featureFlags: Record<string, boolean>;
  modelAllowlist: string[] | null;
  defaultSampler: {
    temperature: number;
    topP: number;
    maxTokens: number;
  };
  hybridFallbackEnabled: boolean;
  appCheckRequired: boolean;
}

export interface ApiKeyRecord {
  id: string;
  userId: string;
  label: string;
  prefix: string;
  hash: string;
  createdAt: number;
  lastUsedAt: number | null;
}

export interface OrgRecord {
  id: string;
  name: string;
  ownerId: string;
  memberIds: string[];
  createdAt: number;
}

export interface AuditEntry {
  id: string;
  at: number;
  actorId: string;
  action: string;
  target: string;
  meta?: Record<string, unknown>;
}

export interface NotificationRecord {
  id: string;
  userId: string;
  kind: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: number;
}

export interface QuotaUsage {
  tokens: number;
  scrapes: number;
  rooms: number;
  periodStart: number;
}

export const DEFAULT_REMOTE_CONFIG: RemoteConfigPayload = {
  featureFlags: {
    webTools: true,
    agentMode: true,
    mcp: true,
    hybridFallback: true,
    orgWorkspaces: true,
  },
  modelAllowlist: null,
  defaultSampler: { temperature: 0.7, topP: 0.95, maxTokens: 512 },
  hybridFallbackEnabled: true,
  appCheckRequired: false,
};

export const QUOTA_LIMITS = {
  tokens: 500_000,
  scrapes: 500,
  rooms: 20,
};

const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function b64url(data: string): string {
  return btoa(data).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(s: string): string {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
}

async function hmac(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return b64url(String.fromCharCode(...new Uint8Array(sig)));
}

export async function signToken(
  userId: string,
  secret: string,
): Promise<string> {
  const exp = Date.now() + TOKEN_TTL_MS;
  const payload = b64url(JSON.stringify({ sub: userId, exp }));
  const sig = await hmac(secret, payload);
  return `${payload}.${sig}`;
}

export async function verifyToken(
  token: string,
  secret: string,
): Promise<{ userId: string } | null> {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, sig] = parts as [string, string];
  const expected = await hmac(secret, payload);
  if (sig !== expected) return null;
  try {
    const data = JSON.parse(fromB64url(payload)) as { sub?: string; exp?: number };
    if (!data.sub || !data.exp || Date.now() > data.exp) return null;
    return { userId: data.sub };
  } catch {
    return null;
  }
}

export function newId(prefix: string): string {
  const hex = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
  return `${prefix}_${hex}`;
}

export async function hashApiKey(raw: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function authSecret(env: { AUTH_SECRET?: string }): string {
  return env.AUTH_SECRET ?? "teamthink-dev-secret-change-me";
}

export function parseBearer(req: Request): string | null {
  const h = req.headers.get("authorization") ?? "";
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m?.[1]?.trim() ?? null;
}

export function parseAppCheck(req: Request): string | null {
  return req.headers.get("x-teamthink-app-check")?.trim() ?? null;
}

/** Dev App Check: any non-empty header passes when appCheckRequired is false. */
export function appCheckOk(
  req: Request,
  config: RemoteConfigPayload,
): boolean {
  if (!config.appCheckRequired) return true;
  const token = parseAppCheck(req);
  return !!token && token.length >= 8;
}

export function corsJson(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
      "Access-Control-Allow-Headers":
        "content-type,authorization,x-teamthink-app-check,x-api-key",
    },
  });
}
