/**
 * Global platform Durable Object: users, orgs, API keys, audit, notifications,
 * remote config, and per-user quotas.
 */

import {
  DEFAULT_REMOTE_CONFIG,
  QUOTA_LIMITS,
  type ApiKeyRecord,
  type AuditEntry,
  type AuthUser,
  type NotificationRecord,
  type OrgRecord,
  type QuotaUsage,
  type RemoteConfigPayload,
  authSecret,
  hashApiKey,
  newId,
  signToken,
  verifyToken,
} from "./platform";

export interface PlatformEnv {
  PLATFORM: DurableObjectNamespace;
  AUTH_SECRET?: string;
}

const USER_PREFIX = "user:";
const MEMBER_PREFIX = "member:";
const ROOM_STATE_PREFIX = "roomstate:";
const PRESENCE_PREFIX = "presence:";
const APIKEY_PREFIX = "apikey:";
const ORG_PREFIX = "org:";
const AUDIT_PREFIX = "audit:";
const NOTIFY_PREFIX = "notify:";
const QUOTA_PREFIX = "quota:";
const ARTIFACT_PREFIX = "artifact:";
const CONFIG_KEY = "remoteConfig";

export interface PlatformAttach {
  kind: "platform";
}

/** One global instance for identity and platform services. */
export class PlatformDO {
  constructor(
    private state: DurableObjectState,
    private env: PlatformEnv,
  ) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === "/auth/anonymous" && request.method === "POST") {
      return this.authAnonymous(request);
    }
    if (path === "/auth/magic-link" && request.method === "POST") {
      return this.authMagicLink(request);
    }
    if (path === "/auth/oauth" && request.method === "POST") {
      return this.authOAuth(request);
    }
    if (path === "/auth/upgrade" && request.method === "POST") {
      return this.authUpgrade(request);
    }
    if (path === "/auth/me" && request.method === "GET") {
      return this.authMe(request);
    }
    if (path === "/config" && request.method === "GET") {
      return this.getConfig();
    }
    if (path === "/config" && request.method === "PUT") {
      return this.putConfig(request);
    }
    if (path.startsWith("/rooms/") && path.endsWith("/state")) {
      const roomId = path.split("/")[2] ?? "";
      if (request.method === "GET") return this.getRoomState(roomId);
      if (request.method === "PUT") return this.putRoomState(roomId, request);
    }
    if (path.startsWith("/rooms/") && path.endsWith("/presence")) {
      const roomId = path.split("/")[2] ?? "";
      if (request.method === "GET") return this.getPresence(roomId);
      if (request.method === "PUT") return this.putPresence(roomId, request);
    }
    if (path.startsWith("/rooms/") && path.endsWith("/members")) {
      const roomId = path.split("/")[2] ?? "";
      if (request.method === "GET") return this.listMembers(roomId);
      if (request.method === "POST") return this.joinRoom(roomId, request);
    }
    if (path === "/api-keys" && request.method === "GET") {
      return this.listApiKeys(request);
    }
    if (path === "/api-keys" && request.method === "POST") {
      return this.createApiKey(request);
    }
    if (path.startsWith("/api-keys/") && request.method === "DELETE") {
      return this.deleteApiKey(path.split("/")[2] ?? "", request);
    }
    if (path === "/orgs" && request.method === "POST") {
      return this.createOrg(request);
    }
    if (path.startsWith("/orgs/") && request.method === "GET") {
      return this.getOrg(path.split("/")[2] ?? "", request);
    }
    if (path === "/audit" && request.method === "GET") {
      return this.listAudit(request);
    }
    if (path === "/notifications" && request.method === "GET") {
      return this.listNotifications(request);
    }
    if (path === "/notifications/read" && request.method === "POST") {
      return this.markNotificationsRead(request);
    }
    if (path === "/quotas/me" && request.method === "GET") {
      return this.getQuotas(request);
    }
    if (path === "/quotas/consume" && request.method === "POST") {
      return this.consumeQuota(request);
    }
    if (path === "/artifacts" && request.method === "POST") {
      return this.uploadArtifact(request);
    }
    if (path.startsWith("/artifacts/") && request.method === "GET") {
      return this.getArtifact(path.split("/")[2] ?? "", request);
    }
    if (path === "/triggers/room-created" && request.method === "POST") {
      return this.triggerRoomCreated(request);
    }

    return new Response("not found", { status: 404 });
  }

  private secret(): string {
    return authSecret(this.env);
  }

  private async requireUser(req: Request): Promise<AuthUser | Response> {
    const token = (await import("./platform")).parseBearer(req);
    if (!token) return new Response("unauthorized", { status: 401 });
    const verified = await verifyToken(token, this.secret());
    if (!verified) return new Response("invalid token", { status: 401 });
    const user = await this.state.storage.get<AuthUser>(USER_PREFIX + verified.userId);
    if (!user) return new Response("user not found", { status: 404 });
    return user;
  }

  private async audit(actorId: string, action: string, target: string, meta?: Record<string, unknown>): Promise<void> {
    const entry: AuditEntry = {
      id: newId("aud"),
      at: Date.now(),
      actorId,
      action,
      target,
      meta,
    };
    await this.state.storage.put(AUDIT_PREFIX + entry.id, entry);
  }

  private async notify(userId: string, kind: string, title: string, body: string): Promise<void> {
    const n: NotificationRecord = {
      id: newId("ntf"),
      userId,
      kind,
      title,
      body,
      read: false,
      createdAt: Date.now(),
    };
    await this.state.storage.put(NOTIFY_PREFIX + n.id, n);
  }

  private async authAnonymous(request: Request): Promise<Response> {
    const body = (await request.json().catch(() => ({}))) as { displayName?: string };
    const user: AuthUser = {
      id: newId("usr"),
      email: null,
      displayName: body.displayName?.trim() || "Guest",
      provider: "anonymous",
      createdAt: Date.now(),
    };
    await this.state.storage.put(USER_PREFIX + user.id, user);
    const token = await signToken(user.id, this.secret());
    await this.audit(user.id, "auth.anonymous", user.id);
    return Response.json({ token, user });
  }

  private async authMagicLink(request: Request): Promise<Response> {
    const body = (await request.json()) as { email?: string };
    const email = body.email?.trim().toLowerCase();
    if (!email?.includes("@")) {
      return new Response(JSON.stringify({ error: "valid email required" }), { status: 400 });
    }
    const existing = await this.findUserByEmail(email);
    const user: AuthUser = existing ?? {
      id: newId("usr"),
      email,
      displayName: email.split("@")[0] ?? "User",
      provider: "magic",
      createdAt: Date.now(),
    };
    if (!existing) {
      await this.state.storage.put(USER_PREFIX + user.id, user);
    }
    const token = await signToken(user.id, this.secret());
    await this.audit(user.id, "auth.magic_link", user.id, { email });
    return Response.json({ token, user, magicLinkSent: true });
  }

  private async authOAuth(request: Request): Promise<Response> {
    const body = (await request.json()) as {
      provider?: "google" | "github";
      code?: string;
      email?: string;
      displayName?: string;
    };
    if (!body.provider || !body.code) {
      return new Response(JSON.stringify({ error: "provider and code required" }), { status: 400 });
    }
    const email =
      body.email?.trim().toLowerCase() ??
      `${body.provider}_${body.code.slice(0, 8)}@oauth.local`;
    const existing = await this.findUserByEmail(email);
    const user: AuthUser = existing ?? {
      id: newId("usr"),
      email,
      displayName: body.displayName?.trim() || email.split("@")[0] ?? "User",
      provider: body.provider,
      createdAt: Date.now(),
    };
    if (!existing) {
      await this.state.storage.put(USER_PREFIX + user.id, user);
    }
    const token = await signToken(user.id, this.secret());
    await this.audit(user.id, "auth.oauth", user.id, { provider: body.provider });
    return Response.json({ token, user });
  }

  private async authUpgrade(request: Request): Promise<Response> {
    const userOrErr = await this.requireUser(request);
    if (userOrErr instanceof Response) return userOrErr;
    const body = (await request.json()) as { email?: string };
    const email = body.email?.trim().toLowerCase();
    if (!email?.includes("@")) {
      return new Response(JSON.stringify({ error: "valid email required" }), { status: 400 });
    }
    const upgraded: AuthUser = { ...userOrErr, email, provider: "magic" };
    await this.state.storage.put(USER_PREFIX + upgraded.id, upgraded);
    const token = await signToken(upgraded.id, this.secret());
    await this.audit(upgraded.id, "auth.upgrade", upgraded.id, { email });
    return Response.json({ token, user: upgraded });
  }

  private async authMe(request: Request): Promise<Response> {
    const userOrErr = await this.requireUser(request);
    if (userOrErr instanceof Response) return userOrErr;
    return Response.json({ user: userOrErr });
  }

  private async findUserByEmail(email: string): Promise<AuthUser | undefined> {
    const map = await this.state.storage.list<AuthUser>({ prefix: USER_PREFIX });
    for (const [, u] of map) {
      if (u.email === email) return u;
    }
    return undefined;
  }

  private async getConfig(): Promise<Response> {
    const cfg =
      (await this.state.storage.get<RemoteConfigPayload>(CONFIG_KEY)) ??
      DEFAULT_REMOTE_CONFIG;
    return Response.json(cfg);
  }

  private async putConfig(request: Request): Promise<Response> {
    const userOrErr = await this.requireUser(request);
    if (userOrErr instanceof Response) return userOrErr;
    const body = (await request.json()) as Partial<RemoteConfigPayload>;
    const current =
      (await this.state.storage.get<RemoteConfigPayload>(CONFIG_KEY)) ??
      DEFAULT_REMOTE_CONFIG;
    const merged = { ...current, ...body, featureFlags: { ...current.featureFlags, ...body.featureFlags } };
    await this.state.storage.put(CONFIG_KEY, merged);
    await this.audit(userOrErr.id, "config.update", CONFIG_KEY);
    return Response.json(merged);
  }

  private async getRoomState(roomId: string): Promise<Response> {
    const state = await this.state.storage.get(ROOM_STATE_PREFIX + roomId);
    return Response.json(state ?? { updatedAt: 0 });
  }

  private async putRoomState(roomId: string, request: Request): Promise<Response> {
    const userOrErr = await this.requireUser(request);
    if (userOrErr instanceof Response) return userOrErr;
    const body = await request.json();
    const payload = { ...(body as object), updatedAt: Date.now() };
    await this.state.storage.put(ROOM_STATE_PREFIX + roomId, payload);
    await this.audit(userOrErr.id, "room.state.save", roomId);
    return Response.json({ ok: true, updatedAt: payload.updatedAt });
  }

  private async getPresence(roomId: string): Promise<Response> {
    const presence = await this.state.storage.get(PRESENCE_PREFIX + roomId);
    return Response.json(presence ?? { peers: [] });
  }

  private async putPresence(roomId: string, request: Request): Promise<Response> {
    const body = (await request.json()) as { peers?: unknown[] };
    await this.state.storage.put(PRESENCE_PREFIX + roomId, {
      peers: body.peers ?? [],
      updatedAt: Date.now(),
    });
    return Response.json({ ok: true });
  }

  private async listMembers(roomId: string): Promise<Response> {
    const map = await this.state.storage.list({ prefix: MEMBER_PREFIX + roomId + ":" });
    const members = [...map.values()];
    return Response.json({ members });
  }

  private async joinRoom(roomId: string, request: Request): Promise<Response> {
    const userOrErr = await this.requireUser(request);
    if (userOrErr instanceof Response) return userOrErr;
    const body = (await request.json().catch(() => ({}))) as {
      role?: string;
      compute?: boolean;
    };
    const members = await this.state.storage.list({ prefix: MEMBER_PREFIX + roomId + ":" });
    const isFirst = members.size === 0;
    const member = {
      userId: userOrErr.id,
      displayName: userOrErr.displayName,
      role: isFirst ? "owner" : (body.role ?? "member"),
      compute: body.compute ?? false,
      joinedAt: Date.now(),
    };
    await this.state.storage.put(MEMBER_PREFIX + roomId + ":" + userOrErr.id, member);
    await this.audit(userOrErr.id, "room.join", roomId, { role: member.role });
    return Response.json({ member });
  }

  private async listApiKeys(request: Request): Promise<Response> {
    const userOrErr = await this.requireUser(request);
    if (userOrErr instanceof Response) return userOrErr;
    const map = await this.state.storage.list<ApiKeyRecord>({ prefix: APIKEY_PREFIX });
    const keys = [...map.values()].filter((k) => k.userId === userOrErr.id);
    return Response.json({
      keys: keys.map(({ hash: _h, ...rest }) => rest),
    });
  }

  private async createApiKey(request: Request): Promise<Response> {
    const userOrErr = await this.requireUser(request);
    if (userOrErr instanceof Response) return userOrErr;
    const body = (await request.json().catch(() => ({}))) as { label?: string };
    const raw = `tt_${crypto.randomUUID().replace(/-/g, "")}`;
    const record: ApiKeyRecord = {
      id: newId("key"),
      userId: userOrErr.id,
      label: body.label?.trim() || "Default",
      prefix: raw.slice(0, 12),
      hash: await hashApiKey(raw),
      createdAt: Date.now(),
      lastUsedAt: null,
    };
    await this.state.storage.put(APIKEY_PREFIX + record.id, record);
    await this.audit(userOrErr.id, "apikey.create", record.id);
    return Response.json({ key: record, secret: raw });
  }

  private async deleteApiKey(keyId: string, request: Request): Promise<Response> {
    const userOrErr = await this.requireUser(request);
    if (userOrErr instanceof Response) return userOrErr;
    const record = await this.state.storage.get<ApiKeyRecord>(APIKEY_PREFIX + keyId);
    if (!record || record.userId !== userOrErr.id) {
      return new Response("not found", { status: 404 });
    }
    await this.state.storage.delete(APIKEY_PREFIX + keyId);
    await this.audit(userOrErr.id, "apikey.revoke", keyId);
    return Response.json({ ok: true });
  }

  private async createOrg(request: Request): Promise<Response> {
    const userOrErr = await this.requireUser(request);
    if (userOrErr instanceof Response) return userOrErr;
    const body = (await request.json()) as { name?: string };
    const org: OrgRecord = {
      id: newId("org"),
      name: body.name?.trim() || "My team",
      ownerId: userOrErr.id,
      memberIds: [userOrErr.id],
      createdAt: Date.now(),
    };
    await this.state.storage.put(ORG_PREFIX + org.id, org);
    await this.audit(userOrErr.id, "org.create", org.id);
    return Response.json({ org });
  }

  private async getOrg(orgId: string, request: Request): Promise<Response> {
    const userOrErr = await this.requireUser(request);
    if (userOrErr instanceof Response) return userOrErr;
    const org = await this.state.storage.get<OrgRecord>(ORG_PREFIX + orgId);
    if (!org) return new Response("not found", { status: 404 });
    return Response.json({ org });
  }

  private async listAudit(request: Request): Promise<Response> {
    const userOrErr = await this.requireUser(request);
    if (userOrErr instanceof Response) return userOrErr;
    const map = await this.state.storage.list<AuditEntry>({ prefix: AUDIT_PREFIX });
    const entries = [...map.values()].sort((a, b) => b.at - a.at).slice(0, 200);
    return Response.json({ entries });
  }

  private async listNotifications(request: Request): Promise<Response> {
    const userOrErr = await this.requireUser(request);
    if (userOrErr instanceof Response) return userOrErr;
    const map = await this.state.storage.list<NotificationRecord>({ prefix: NOTIFY_PREFIX });
    const items = [...map.values()]
      .filter((n) => n.userId === userOrErr.id)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 50);
    return Response.json({ notifications: items });
  }

  private async markNotificationsRead(request: Request): Promise<Response> {
    const userOrErr = await this.requireUser(request);
    if (userOrErr instanceof Response) return userOrErr;
    const body = (await request.json().catch(() => ({}))) as { ids?: string[] };
    const map = await this.state.storage.list<NotificationRecord>({ prefix: NOTIFY_PREFIX });
    for (const [k, n] of map) {
      if (n.userId !== userOrErr.id) continue;
      if (!body.ids || body.ids.includes(n.id)) {
        await this.state.storage.put(k, { ...n, read: true });
      }
    }
    return Response.json({ ok: true });
  }

  private async getQuotas(request: Request): Promise<Response> {
    const userOrErr = await this.requireUser(request);
    if (userOrErr instanceof Response) return userOrErr;
    const usage = await this.getOrInitQuota(userOrErr.id);
    return Response.json({ usage, limits: QUOTA_LIMITS });
  }

  private async consumeQuota(request: Request): Promise<Response> {
    const userOrErr = await this.requireUser(request);
    if (userOrErr instanceof Response) return userOrErr;
    const body = (await request.json()) as {
      tokens?: number;
      scrapes?: number;
      rooms?: number;
    };
    const usage = await this.getOrInitQuota(userOrErr.id);
    usage.tokens += body.tokens ?? 0;
    usage.scrapes += body.scrapes ?? 0;
    usage.rooms += body.rooms ?? 0;
    await this.state.storage.put(QUOTA_PREFIX + userOrErr.id, usage);
    const exceeded =
      usage.tokens > QUOTA_LIMITS.tokens ||
      usage.scrapes > QUOTA_LIMITS.scrapes ||
      usage.rooms > QUOTA_LIMITS.rooms;
    if (exceeded) {
      await this.notify(userOrErr.id, "quota.exceeded", "Quota exceeded", "Usage limits reached for this period.");
      await this.audit(userOrErr.id, "quota.exceeded", userOrErr.id, { usage });
    }
    return Response.json({ usage, limits: QUOTA_LIMITS, exceeded });
  }

  private async getOrInitQuota(userId: string): Promise<QuotaUsage> {
    const existing = await this.state.storage.get<QuotaUsage>(QUOTA_PREFIX + userId);
    const now = Date.now();
    const periodMs = 30 * 24 * 60 * 60 * 1000;
    if (existing && now - existing.periodStart < periodMs) return existing;
    const fresh: QuotaUsage = { tokens: 0, scrapes: 0, rooms: 0, periodStart: now };
    await this.state.storage.put(QUOTA_PREFIX + userId, fresh);
    return fresh;
  }

  private async uploadArtifact(request: Request): Promise<Response> {
    const userOrErr = await this.requireUser(request);
    if (userOrErr instanceof Response) return userOrErr;
    const body = (await request.json()) as {
      name?: string;
      contentType?: string;
      data?: string;
    };
    if (!body.data) {
      return new Response(JSON.stringify({ error: "data required" }), { status: 400 });
    }
    const id = newId("art");
    await this.state.storage.put(ARTIFACT_PREFIX + id, {
      id,
      userId: userOrErr.id,
      name: body.name ?? "artifact",
      contentType: body.contentType ?? "application/octet-stream",
      data: body.data,
      createdAt: Date.now(),
    });
    await this.audit(userOrErr.id, "artifact.upload", id);
    return Response.json({ id, url: `/artifacts/${id}` });
  }

  private async getArtifact(id: string, request: Request): Promise<Response> {
    const userOrErr = await this.requireUser(request);
    if (userOrErr instanceof Response) return userOrErr;
    const art = await this.state.storage.get<{
      data: string;
      contentType: string;
      name: string;
    }>(ARTIFACT_PREFIX + id);
    if (!art) return new Response("not found", { status: 404 });
    return Response.json(art);
  }

  private async triggerRoomCreated(request: Request): Promise<Response> {
    const body = (await request.json()) as { roomId?: string; userId?: string };
    if (body.userId) {
      await this.notify(
        body.userId,
        "room.created",
        "Room ready",
        `Room ${body.roomId ?? ""} is live.`,
      );
      await this.audit(body.userId, "trigger.room_created", body.roomId ?? "");
    }
    return Response.json({ ok: true });
  }
}
