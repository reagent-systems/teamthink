import { ICE_SERVERS } from "@/lib/config";
import { decryptFrame, encryptFrame } from "@/lib/mesh/crypto";
import { shouldConnectPeer } from "@/lib/mesh/topology";
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
  private allPeers = new Set<string>();
  private encryption = true;
  private roomSecret?: string;

  constructor(
    readonly roomId: string,
    readonly peerId: string,
    private events: MeshEvents = {},
    opts?: { encryption?: boolean; roomSecret?: string },
  ) {
    this.encryption = opts?.encryption ?? true;
    this.roomSecret = opts?.roomSecret;
    this.sig = new WsSignaling(roomId, peerId, {
      onPeers: (peers) => {
        for (const p of peers) this.allPeers.add(p);
        this.reconcileConnections();
      },
      onJoin: (peer) => {
        this.allPeers.add(peer);
        this.maybeInitiate(peer);
      },
      onLeave: (peer) => {
        this.allPeers.delete(peer);
        this.teardown(peer, true);
      },
      onSignal: (from, data) => void this.handleSignal(from, data),
    });
  }

  private reconcileConnections(): void {
    for (const p of this.allPeers) this.maybeInitiate(p);
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
    void this.sendEncrypted(conn.channel, channel, payload);
    return true;
  }

  private async sendEncrypted(
    channel: RTCDataChannel,
    tag: number,
    payload: Uint8Array,
  ): Promise<void> {
    let body = payload;
    if (this.encryption) {
      body = await encryptFrame(this.roomId, payload, this.roomSecret);
    }
    const frame = new Uint8Array(body.length + 1);
    frame[0] = tag;
    frame.set(body, 1);
    if (channel.readyState === "open") channel.send(frame);
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

  /** Partial-mesh: connect only to a bounded subset of peers (gossip topology). */
  private maybeInitiate(peerId: string): void {
    if (peerId === this.peerId || this.connections.has(peerId)) return;
    const connected = this.connectedPeers.length;
    const all = [...this.allPeers, ...this.connectedPeers];
    if (
      !shouldConnectPeer(
        this.peerId,
        peerId,
        this.roomId,
        all,
        connected,
      )
    ) {
      return;
    }
    if (this.shouldInitiate(peerId)) void this.initiate(peerId);
  }

  private canAcceptIncoming(): boolean {
    return this.connectedPeers.length < 8;
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
      void this.onChannelMessage(peerId, e);
    };
  }

  private async onChannelMessage(
    peerId: string,
    e: MessageEvent,
  ): Promise<void> {
    const buf = new Uint8Array(e.data as ArrayBuffer);
    const tag = buf[0]!;
    let payload: Uint8Array = buf.subarray(1);
    if (this.encryption) {
      const dec = await decryptFrame(this.roomId, payload, this.roomSecret);
      if (dec) payload = dec as Uint8Array<ArrayBuffer>;
    }
    const set = this.handlers.get(tag);
    if (set) for (const h of set) h(peerId, payload);
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
      if (!this.canAcceptIncoming()) return;
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
