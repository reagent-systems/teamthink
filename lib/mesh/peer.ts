import { ICE_SERVERS } from "@/lib/config";
import { WsSignaling } from "@/lib/mesh/ws-signaling";

/**
 * Client-side WebRTC full-mesh manager.
 *
 * Peers find each other through a Cloudflare Durable Object over a single
 * WebSocket (see `worker/` and `ws-signaling.ts`): the DO pushes presence
 * (`join`/`leave`) and relays the SDP/ICE handshake. There is no polling and no
 * server in the data path — once the handshake completes, CRDT sync, presence
 * gossip, app messages, and pipeline tensors all flow directly peer-to-peer
 * over WebRTC data channels.
 *
 * Exactly one side of each pair offers (deterministic id tie-break), so the
 * room converges to a full mesh. A dropped peer is detected two ways: the DO's
 * `leave` event (immediate, server-observed socket close) and the local
 * WebRTC connection-state change.
 *
 * Framing: every data-channel frame is a Uint8Array whose first byte is a
 * channel tag, multiplexing logical streams over one channel.
 */

export const CHANNEL_CRDT = 0;
export const CHANNEL_APP = 1;
/** Pipeline-parallel inference traffic (chunked tensors, tokens, control). */
export const CHANNEL_PIPE = 2;

type FrameHandler = (peerId: string, payload: Uint8Array) => void;
type SignalKind = "offer" | "answer" | "candidate";

interface MeshEvents {
  onPeerOpen?: (peerId: string) => void;
  onPeerClose?: (peerId: string) => void;
  onPeersChange?: (peerIds: string[]) => void;
}

interface Connection {
  pc: RTCPeerConnection;
  channel?: RTCDataChannel;
  pendingCandidates: RTCIceCandidateInit[];
  remoteSet: boolean;
  open: boolean;
}

export class MeshClient {
  private connections = new Map<string, Connection>();
  private handlers = new Map<number, Set<FrameHandler>>();
  private sig: WsSignaling;

  constructor(
    readonly roomId: string,
    readonly peerId: string,
    private events: MeshEvents = {},
  ) {
    this.sig = new WsSignaling(roomId, peerId, {
      onPeers: (peers) => {
        for (const p of peers) this.maybeInitiate(p);
      },
      onJoin: (peer) => this.maybeInitiate(peer),
      onLeave: (peer) => this.teardown(peer, true),
      onSignal: (from, data) => void this.handleSignal(from, data),
    });
  }

  async start(): Promise<void> {
    this.sig.start();
  }

  stop(): void {
    this.sig.stop();
    for (const conn of this.connections.values()) {
      conn.channel?.close();
      conn.pc.close();
    }
    this.connections.clear();
  }

  on(channel: number, handler: FrameHandler): () => void {
    let set = this.handlers.get(channel);
    if (!set) {
      set = new Set();
      this.handlers.set(channel, set);
    }
    set.add(handler);
    return () => set!.delete(handler);
  }

  broadcast(channel: number, payload: Uint8Array): void {
    for (const [peerId] of this.connections) this.sendTo(peerId, channel, payload);
  }

  sendTo(peerId: string, channel: number, payload: Uint8Array): boolean {
    const conn = this.connections.get(peerId);
    if (!conn?.channel || conn.channel.readyState !== "open") return false;
    const frame = new Uint8Array(payload.length + 1);
    frame[0] = channel;
    frame.set(payload, 1);
    conn.channel.send(frame);
    return true;
  }

  get connectedPeers(): string[] {
    return [...this.connections.entries()]
      .filter(([, c]) => c.open)
      .map(([id]) => id);
  }

  // --- handshake ------------------------------------------------------------

  /** Deterministic tie-break so exactly one side creates the offer. */
  private shouldInitiate(peerId: string): boolean {
    return this.peerId < peerId;
  }

  private maybeInitiate(peerId: string): void {
    if (peerId === this.peerId || this.connections.has(peerId)) return;
    if (this.shouldInitiate(peerId)) void this.initiate(peerId);
  }

  private send(to: string, kind: SignalKind, payload: unknown): void {
    this.sig.signal(to, { kind, payload });
  }

  private createConnection(peerId: string): Connection {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    const conn: Connection = {
      pc,
      pendingCandidates: [],
      remoteSet: false,
      open: false,
    };
    this.connections.set(peerId, conn);

    pc.onicecandidate = (e) => {
      if (e.candidate) this.send(peerId, "candidate", e.candidate.toJSON());
    };
    pc.onconnectionstatechange = () => {
      const s = pc.connectionState;
      if (s === "failed" || s === "closed") {
        this.teardown(peerId, true);
      } else if (s === "disconnected" && conn.open) {
        conn.open = false;
        this.events.onPeerClose?.(peerId);
        this.events.onPeersChange?.(this.connectedPeers);
      }
    };
    pc.ondatachannel = (e) => this.bindChannel(peerId, conn, e.channel);
    return conn;
  }

  private bindChannel(
    peerId: string,
    conn: Connection,
    channel: RTCDataChannel,
  ): void {
    channel.binaryType = "arraybuffer";
    conn.channel = channel;
    channel.onopen = () => {
      conn.open = true;
      this.events.onPeerOpen?.(peerId);
      this.events.onPeersChange?.(this.connectedPeers);
    };
    channel.onclose = () => {
      if (conn.open) {
        conn.open = false;
        this.events.onPeerClose?.(peerId);
        this.events.onPeersChange?.(this.connectedPeers);
      }
    };
    channel.onmessage = (e) => {
      const buf = new Uint8Array(e.data as ArrayBuffer);
      const tag = buf[0];
      const payload = buf.subarray(1);
      const set = this.handlers.get(tag);
      if (set) for (const h of set) h(peerId, payload);
    };
  }

  private async initiate(peerId: string): Promise<void> {
    if (this.connections.has(peerId)) return;
    const conn = this.createConnection(peerId);
    const channel = conn.pc.createDataChannel("tt", { ordered: true });
    this.bindChannel(peerId, conn, channel);
    const offer = await conn.pc.createOffer();
    await conn.pc.setLocalDescription(offer);
    this.send(peerId, "offer", offer);
  }

  private async handleSignal(from: string, data: unknown): Promise<void> {
    const sig = data as { kind?: SignalKind; payload?: unknown } | null;
    if (!sig?.kind) return;
    let conn = this.connections.get(from);

    if (sig.kind === "offer") {
      if (!conn) conn = this.createConnection(from);
      await conn.pc.setRemoteDescription(
        sig.payload as RTCSessionDescriptionInit,
      );
      conn.remoteSet = true;
      await this.flushCandidates(conn);
      const answer = await conn.pc.createAnswer();
      await conn.pc.setLocalDescription(answer);
      this.send(from, "answer", answer);
    } else if (sig.kind === "answer") {
      if (!conn) return;
      await conn.pc.setRemoteDescription(
        sig.payload as RTCSessionDescriptionInit,
      );
      conn.remoteSet = true;
      await this.flushCandidates(conn);
    } else if (sig.kind === "candidate") {
      if (!conn) return;
      const cand = sig.payload as RTCIceCandidateInit;
      if (conn.remoteSet) {
        await conn.pc.addIceCandidate(cand).catch(() => {});
      } else {
        conn.pendingCandidates.push(cand);
      }
    }
  }

  private async flushCandidates(conn: Connection): Promise<void> {
    for (const cand of conn.pendingCandidates) {
      await conn.pc.addIceCandidate(cand).catch(() => {});
    }
    conn.pendingCandidates = [];
  }

  private teardown(peerId: string, emitClose = false): void {
    const conn = this.connections.get(peerId);
    if (!conn) return;
    const wasOpen = conn.open;
    conn.channel?.close();
    conn.pc.close();
    this.connections.delete(peerId);
    if (emitClose && wasOpen) {
      this.events.onPeerClose?.(peerId);
      this.events.onPeersChange?.(this.connectedPeers);
    }
  }
}
