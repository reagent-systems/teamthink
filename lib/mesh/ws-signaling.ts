import {
  SIGNAL_RECONNECT_MAX_MS,
  SIGNAL_RECONNECT_MIN_MS,
  SIGNAL_WS_URL,
} from "@/lib/config";

/**
 * WebSocket signaling client. Holds one persistent connection to the room's
 * Cloudflare Durable Object (see `worker/`). This is genuine pub/sub: presence
 * (`join`/`leave`) is pushed by the server straight from socket open/close, and
 * the WebRTC handshake is relayed peer-to-peer through the DO. There is no
 * polling. After the handshake, all real traffic is direct over WebRTC.
 */

export interface WsSignalingEvents {
  /** Members already in the room when we connected (excludes us). */
  onPeers?: (peers: string[]) => void;
  onJoin?: (peer: string) => void;
  onLeave?: (peer: string) => void;
  /** A relayed handshake message from `from`. */
  onSignal?: (from: string, data: unknown) => void;
  /** Fired on each (re)connect, after the socket opens. */
  onOpen?: () => void;
}

export class WsSignaling {
  private ws: WebSocket | null = null;
  private attempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private queue: string[] = [];
  private stopped = false;

  constructor(
    private readonly roomId: string,
    private readonly peerId: string,
    private readonly events: WsSignalingEvents,
  ) {}

  start(): void {
    if (!SIGNAL_WS_URL) {
      console.warn(
        "[signaling] NEXT_PUBLIC_SIGNAL_WS_URL is not set; the mesh cannot connect.",
      );
      return;
    }
    this.connect();
  }

  stop(): void {
    this.stopped = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    try {
      this.ws?.close();
    } catch {
      // ignore
    }
    this.ws = null;
  }

  /** Relay a handshake message to a specific peer via the DO. */
  signal(to: string, data: unknown): void {
    this.send({ type: "signal", to, data });
  }

  private connect(): void {
    if (this.stopped) return;
    const url = `${SIGNAL_WS_URL}/ws?room=${encodeURIComponent(
      this.roomId,
    )}&peer=${encodeURIComponent(this.peerId)}`;
    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch {
      this.scheduleReconnect();
      return;
    }
    this.ws = ws;

    ws.onopen = () => {
      if (this.stopped) return;
      this.attempt = 0;
      this.flush();
      this.events.onOpen?.();
    };

    ws.onmessage = (e) => {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(typeof e.data === "string" ? e.data : "") as Record<
          string,
          unknown
        >;
      } catch {
        return;
      }
      switch (msg.type) {
        case "peers":
          this.events.onPeers?.((msg.peers as string[] | undefined) ?? []);
          break;
        case "join":
          if (typeof msg.peer === "string") this.events.onJoin?.(msg.peer);
          break;
        case "leave":
          if (typeof msg.peer === "string") this.events.onLeave?.(msg.peer);
          break;
        case "signal":
          if (typeof msg.from === "string") {
            this.events.onSignal?.(msg.from, msg.data);
          }
          break;
      }
    };

    ws.onerror = () => {
      try {
        ws.close();
      } catch {
        // onclose handles reconnect
      }
    };

    ws.onclose = () => {
      if (this.ws === ws) this.ws = null;
      this.scheduleReconnect();
    };
  }

  private scheduleReconnect(): void {
    if (this.stopped || this.reconnectTimer) return;
    const delay = Math.min(
      SIGNAL_RECONNECT_MAX_MS,
      SIGNAL_RECONNECT_MIN_MS * 2 ** Math.min(this.attempt, 4),
    );
    this.attempt += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private send(obj: Record<string, unknown>): void {
    const data = JSON.stringify(obj);
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(data);
    } else {
      this.queue.push(data);
      if (this.queue.length > 256) this.queue.shift();
    }
  }

  private flush(): void {
    const pending = this.queue;
    this.queue = [];
    for (const data of pending) {
      try {
        this.ws?.send(data);
      } catch {
        // ignore
      }
    }
  }
}
