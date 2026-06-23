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

export interface Env {
  ROOMS: DurableObjectNamespace;
  REGISTRY: DurableObjectNamespace;
}

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
};

const ROOM_RE = /^[A-Za-z0-9_-]{1,64}$/;
const PEER_RE = /^[A-Za-z0-9_-]{1,64}$/;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS });
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

    return new Response("teamthink signaling", { headers: CORS });
  },
};

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
