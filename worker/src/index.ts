/**
 * TeamThink signaling Worker.
 *
 * Each peer opens a single WebSocket to the room's Durable Object. The DO:
 *   - relays the WebRTC SDP/ICE handshake between peers (it never sees the
 *     peer-to-peer data that flows afterward),
 *   - emits `join`/`leave` presence events straight from socket open/close —
 *     real pub/sub, no client polling, native disconnect detection, and
 *   - keeps a global pool registry (via RegistryDO) updated on membership
 *     change so the landing page can list live pools.
 *
 * Sockets are accepted with the Hibernation API, so idle connections cost
 * effectively nothing while still detecting disconnects.
 */

import { PlatformDO } from "./platform-do";
import {
  appCheckOk,
  corsJson,
  DEFAULT_REMOTE_CONFIG,
} from "./platform";

export { PlatformDO };

export interface Env {
  ROOMS: DurableObjectNamespace;
  REGISTRY: DurableObjectNamespace;
  PLATFORM: DurableObjectNamespace;
  AUTH_SECRET?: string;
}

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
  "Access-Control-Allow-Headers":
    "content-type,authorization,x-teamthink-app-check,x-api-key",
};

const ROOM_RE = /^[A-Za-z0-9_-]{1,64}$/;
const PEER_RE = /^[A-Za-z0-9_-]{1,64}$/;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", ...CORS },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS });
    }

    const platformPaths = [
      "/auth/",
      "/config",
      "/rooms/",
      "/api-keys",
      "/orgs",
      "/audit",
      "/notifications",
      "/quotas/",
      "/artifacts",
      "/triggers/",
    ];
    if (platformPaths.some((p) => url.pathname.startsWith(p) || url.pathname === p.replace(/\/$/, ""))) {
      const config = DEFAULT_REMOTE_CONFIG;
      if (!appCheckOk(request, config)) {
        return corsJson({ error: "app check required" }, 403);
      }
      const stub = env.PLATFORM.get(env.PLATFORM.idFromName("global"));
      const res = await stub.fetch(
        new Request(`https://do${url.pathname}${url.search}`, {
          method: request.method,
          headers: request.headers,
          body:
            request.method === "GET" || request.method === "HEAD"
              ? undefined
              : await request.text(),
        }),
      );
      return new Response(await res.text(), {
        status: res.status,
        headers: { "content-type": "application/json", ...CORS },
      });
    }

    if (url.pathname === "/ws") {
      const room = url.searchParams.get("room") ?? "";
      const peer = url.searchParams.get("peer") ?? "";
      if (!ROOM_RE.test(room) || !PEER_RE.test(peer)) {
        return new Response("bad request", { status: 400, headers: CORS });
      }
      const id = env.ROOMS.idFromName(room);
      return env.ROOMS.get(id).fetch(request);
    }

    if (url.pathname === "/pools") {
      const id = env.REGISTRY.idFromName("global");
      const res = await env.REGISTRY.get(id).fetch("https://do/list");
      return new Response(await res.text(), {
        headers: { "content-type": "application/json", ...CORS },
      });
    }

    if (url.pathname === "/scrape" && request.method === "POST") {
      if (!appCheckOk(request, DEFAULT_REMOTE_CONFIG)) {
        return json({ error: "app check required" }, 403);
      }
      try {
        const body = (await request.json()) as { url?: string };
        if (!body.url) return json({ error: "url required" }, 400);
        const { fetchAndParse } = await import("./scrape");
        const page = await fetchAndParse(body.url);
        return json(page);
      } catch (err) {
        return json(
          { error: err instanceof Error ? err.message : "scrape failed" },
          502,
        );
      }
    }

    if (url.pathname === "/search" && request.method === "POST") {
      try {
        const body = (await request.json()) as {
          query?: string;
          limit?: number;
          mode?: "web" | "news" | "images";
        };
        if (!body.query?.trim()) return json({ error: "query required" }, 400);
        const { searchWeb } = await import("./scrape");
        const results = await searchWeb(
          body.query,
          body.limit ?? 5,
          body.mode ?? "web",
        );
        return json({ results });
      } catch (err) {
        return json(
          { error: err instanceof Error ? err.message : "search failed" },
          502,
        );
      }
    }

    if (url.pathname === "/crawl" && request.method === "POST") {
      try {
        const body = (await request.json()) as {
          url?: string;
          maxDepth?: number;
          maxPages?: number;
        };
        if (!body.url) return json({ error: "url required" }, 400);
        const { crawlDomain } = await import("./scrape");
        const pages = await crawlDomain(
          body.url,
          Math.min(body.maxDepth ?? 1, 3),
          Math.min(body.maxPages ?? 10, 25),
        );
        return json({ pages });
      } catch (err) {
        return json(
          { error: err instanceof Error ? err.message : "crawl failed" },
          502,
        );
      }
    }

    if (url.pathname === "/sitemap" && request.method === "POST") {
      try {
        const body = (await request.json()) as { url?: string };
        if (!body.url) return json({ error: "url required" }, 400);
        const { fetchAndParse } = await import("./scrape");
        const page = await fetchAndParse(body.url);
        return json({ url: page.url, links: page.links });
      } catch (err) {
        return json(
          { error: err instanceof Error ? err.message : "sitemap failed" },
          502,
        );
      }
    }

    if (url.pathname === "/extract-json" && request.method === "POST") {
      try {
        const body = (await request.json()) as { url?: string; schemaHint?: string };
        if (!body.url) return json({ error: "url required" }, 400);
        const { fetchHtmlRaw } = await import("./scrape");
        const { extractStructuredFromHtml } = await import("./extract-json");
        const html = await fetchHtmlRaw(body.url);
        return json(extractStructuredFromHtml(html, body.schemaHint));
      } catch (err) {
        return json(
          { error: err instanceof Error ? err.message : "extract failed" },
          502,
        );
      }
    }

    if (url.pathname === "/parse-pdf" && request.method === "POST") {
      try {
        const body = (await request.json()) as { url?: string };
        if (!body.url) return json({ error: "url required" }, 400);
        const target = new URL(body.url);
        if (!["http:", "https:"].includes(target.protocol)) {
          return json({ error: "invalid url" }, 400);
        }
        const res = await fetch(target.href, {
          headers: { "User-Agent": "TeamThink-Scraper/0.9" },
        });
        if (!res.ok) return json({ error: `HTTP ${res.status}` }, 502);
        const buf = new Uint8Array(await res.arrayBuffer());
        const text = extractPdfText(buf);
        return json({ url: target.href, markdown: text.slice(0, 48_000) });
      } catch (err) {
        return json(
          { error: err instanceof Error ? err.message : "pdf parse failed" },
          502,
        );
      }
    }

    if (url.pathname === "/turn/credentials" && request.method === "GET") {
      const turnUrl = (env as { TURN_URL?: string }).TURN_URL ?? process.env.TURN_URL;
      if (!turnUrl) {
        return json({
          servers: [
            { urls: "stun:stun.l.google.com:19302" },
          ],
        });
      }
      const username = `tt_${Date.now()}`;
      const credential = b64Credential(username);
      return json({
        servers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: turnUrl, username, credential },
        ],
      });
    }

    return new Response("teamthink signaling", { headers: CORS });
  },
};

function b64Credential(seed: string): string {
  return btoa(seed).replace(/=+$/, "");
}

interface Attach {
  peer: string;
  room: string;
}

/** One instance per room. Holds the peers' WebSockets and relays signaling. */
export class RoomDO {
  constructor(
    private state: DurableObjectState,
    private env: Env,
  ) {}

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("expected websocket", { status: 426 });
    }
    const url = new URL(request.url);
    const room = url.searchParams.get("room") ?? "";
    const peer = url.searchParams.get("peer") ?? "";

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];

    // Tag with the peer id so we can target relays, and stash room+peer so the
    // close handler still knows them after the DO hibernates and rehydrates.
    this.state.acceptWebSocket(server, [peer]);
    server.serializeAttachment({ peer, room } satisfies Attach);

    // Greet: tell the newcomer who's already here, tell everyone else they joined.
    server.send(JSON.stringify({ type: "peers", peers: this.peers(server) }));
    this.broadcast(server, { type: "join", peer });
    await this.touchRegistry(room, this.state.getWebSockets().length);

    return new Response(null, { status: 101, webSocket: client });
  }

  webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): void {
    if (typeof message !== "string") return;
    const self = (ws.deserializeAttachment() as Attach | null)?.peer;
    if (!self) return;
    let msg: { type?: string; to?: string; data?: unknown };
    try {
      msg = JSON.parse(message) as typeof msg;
    } catch {
      return;
    }
    if (msg.type === "signal" && typeof msg.to === "string") {
      const out = JSON.stringify({ type: "signal", from: self, data: msg.data });
      for (const t of this.state.getWebSockets(msg.to)) {
        try {
          t.send(out);
        } catch {
          // ignore a dead socket; its close handler will clean up
        }
      }
    }
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    const att = ws.deserializeAttachment() as Attach | null;
    try {
      ws.close();
    } catch {
      // already closed
    }
    if (!att) return;
    const remaining = this.state
      .getWebSockets()
      .filter((w) => w !== ws).length;
    this.broadcast(ws, { type: "leave", peer: att.peer });
    await this.touchRegistry(att.room, remaining);
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    return this.webSocketClose(ws);
  }

  private peers(except: WebSocket): string[] {
    const out: string[] = [];
    for (const ws of this.state.getWebSockets()) {
      if (ws === except) continue;
      const a = ws.deserializeAttachment() as Attach | null;
      if (a?.peer) out.push(a.peer);
    }
    return out;
  }

  private broadcast(except: WebSocket, obj: unknown): void {
    const s = JSON.stringify(obj);
    for (const ws of this.state.getWebSockets()) {
      if (ws === except) continue;
      try {
        ws.send(s);
      } catch {
        // ignore
      }
    }
  }

  private async touchRegistry(room: string, peers: number): Promise<void> {
    const stub = this.env.REGISTRY.get(this.env.REGISTRY.idFromName("global"));
    const action = peers > 0 ? "update" : "remove";
    try {
      await stub.fetch(`https://do/${action}`, {
        method: "POST",
        body: JSON.stringify({ room, peers }),
      });
    } catch {
      // registry is best-effort; signaling still works without it
    }
    await this.mirrorPresence(room);
  }

  /** Server-backed presence mirror for clients that can't hold a full mesh. */
  private async mirrorPresence(room: string): Promise<void> {
    if (!("PLATFORM" in this.env)) return;
    const env = this.env as Env;
    const peers: { peer: string; at: number }[] = [];
    for (const ws of this.state.getWebSockets()) {
      const a = ws.deserializeAttachment() as Attach | null;
      if (a?.peer) peers.push({ peer: a.peer, at: Date.now() });
    }
    try {
      const stub = env.PLATFORM.get(env.PLATFORM.idFromName("global"));
      await stub.fetch("https://do/rooms/" + room + "/presence", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ peers }),
      });
    } catch {
      // best-effort
    }
  }
}

interface PoolEntry {
  room: string;
  peers: number;
  updatedAt: number;
}

const POOL_PREFIX = "pool:";
const POOL_STALE_MS = 10 * 60 * 1000;

/** Single global instance: the directory of live pools. */
export class RegistryDO {
  constructor(
    private state: DurableObjectState,
    private env: Env,
  ) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/list") {
      const map = await this.state.storage.list<PoolEntry>({
        prefix: POOL_PREFIX,
      });
      const now = Date.now();
      const pools: PoolEntry[] = [];
      for (const [k, v] of map) {
        if (now - v.updatedAt > POOL_STALE_MS) {
          await this.state.storage.delete(k);
          continue;
        }
        pools.push(v);
      }
      pools.sort((a, b) => b.updatedAt - a.updatedAt);
      return Response.json({ pools });
    }

    let body: { room?: string; peers?: number } = {};
    try {
      body = (await request.json()) as typeof body;
    } catch {
      // empty body
    }
    const room = body.room;
    if (typeof room !== "string") {
      return new Response("bad request", { status: 400 });
    }
    if (url.pathname === "/update") {
      await this.state.storage.put(POOL_PREFIX + room, {
        room,
        peers: body.peers ?? 0,
        updatedAt: Date.now(),
      } satisfies PoolEntry);
    } else if (url.pathname === "/remove") {
      await this.state.storage.delete(POOL_PREFIX + room);
    }
    return new Response("ok");
  }
}

/** Best-effort text extraction from PDF byte streams (no full PDF parser). */
function extractPdfText(bytes: Uint8Array): string {
  const raw = new TextDecoder("latin1").decode(bytes);
  const chunks: string[] = [];
  const paren = /\(([^)\\]{3,})\)/g;
  let m: RegExpExecArray | null;
  while ((m = paren.exec(raw))) {
    const t = m[1]!.replace(/\\n/g, "\n").replace(/\\r/g, "").trim();
    if (t.length > 2 && /[a-zA-Z]/.test(t)) chunks.push(t);
  }
  const stream = raw.match(/stream[\s\S]*?endstream/g) ?? [];
  for (const block of stream) {
    const words = block.match(/[A-Za-z][A-Za-z0-9',.-]{2,}/g) ?? [];
    if (words.length > 8) chunks.push(words.join(" "));
  }
  return [...new Set(chunks)].join("\n\n").replace(/\s+/g, " ").trim();
}
