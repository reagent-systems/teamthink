import { ICE_SERVERS, SIGNALING_SERVERS } from "@/lib/config";
import { SignalingClient } from "@/lib/mesh/signaling";

/**
 * Client-side WebRTC full-mesh manager built on a "tracker → seed" model.
 *
 * The public pub/sub relay (see `signaling.ts`) is used only to find a *first*
 * peer: a joiner announces itself, an existing member replies, and the two
 * complete a single SDP/ICE handshake over the relay. That first peer is the
 * "seed". From then on the mesh is self-sustaining: peers gossip the membership
 * list to each other (PEX) over their data channels, and brokers relay the
 * WebRTC handshake for *new* pairs through the channels they already have. A
 * stable mesh sends nothing on the relay, and growing the mesh costs the relay
 * only one bootstrap handshake per joiner instead of one per pair.
 *
 * The relay stays connected but idle so the node can keep seeding future
 * joiners, and remains a fallback if a mesh-brokered handshake fails. Nothing —
 * not signaling, not data — touches our own origin; the deployment only serves
 * the static page.
 *
 * Framing: every data-channel frame is a Uint8Array whose first byte is a
 * channel tag, letting multiple logical streams (CRDT sync, app messages,
 * pipeline tensors, and internal mesh control) share one channel.
 */

export const CHANNEL_CRDT = 0;
export const CHANNEL_APP = 1;
/** Pipeline-parallel inference traffic (chunked tensors, tokens, control). */
export const CHANNEL_PIPE = 2;
/** Internal: peer-exchange + brokered handshake. Not for application use. */
const CHANNEL_MESH = 3;

type FrameHandler = (peerId: string, payload: Uint8Array) => void;
type WebrtcKind = "offer" | "answer" | "candidate";

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
  /** Set when this connection was started via a mesh broker (for fallback). */
  brokerTimer?: ReturnType<typeof setTimeout>;
}

/** Re-announce schedule (ms after join/reconnect) to survive relay races. */
const ANNOUNCE_BURST_MS = [0, 1500, 4000];
/** If a mesh-brokered handshake hasn't opened in this long, retry over relay. */
const BROKER_FALLBACK_MS = 9000;

const enc = new TextEncoder();
const dec = new TextDecoder();

export class MeshClient {
  private connections = new Map<string, Connection>();
  private handlers = new Map<number, Set<FrameHandler>>();
  private signaling: SignalingClient;
  private announceTimers: ReturnType<typeof setTimeout>[] = [];
  private stopped = false;
  /** For a peer we are not directly connected to, the neighbour that can relay
   * our handshake to it. Also records the return path for inbound brokered
   * signals. */
  private brokerFor = new Map<string, string>();
  /** True once we've started/seeded our first connection, so additional relay
   * responders don't each trigger a separate bootstrap handshake. */
  private seeded = false;

  constructor(
    readonly roomId: string,
    readonly peerId: string,
    private events: MeshEvents = {},
  ) {
    this.signaling = new SignalingClient(
      `teamthink/${roomId}`,
      SIGNALING_SERVERS,
      {
        onMessage: (msg) => this.onSignal(msg),
        onOpen: () => this.announceBurst(),
      },
    );
  }

  async start(): Promise<void> {
    this.signaling.start();
  }

  stop(): void {
    this.stopped = true;
    for (const t of this.announceTimers) clearTimeout(t);
    this.announceTimers = [];
    // Best-effort departure notice so peers tear down promptly.
    this.signaling.publish({ kind: "bye", from: this.peerId });
    this.signaling.stop();
    for (const [, conn] of this.connections) {
      if (conn.brokerTimer) clearTimeout(conn.brokerTimer);
      conn.channel?.close();
      conn.pc.close();
    }
    this.connections.clear();
    this.brokerFor.clear();
  }

  /** Subscribe to frames on a logical channel. Returns an unsubscribe fn. */
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

  // --- discovery / signaling ------------------------------------------------

  /** Announce presence a few times to ride out relay/connect races. */
  private announceBurst(): void {
    for (const t of this.announceTimers) clearTimeout(t);
    this.announceTimers = ANNOUNCE_BURST_MS.map((d) =>
      setTimeout(() => {
        if (this.stopped) return;
        // Stop re-announcing once we're part of a mesh; new joiners announce
        // themselves and existing peers reply, so the relay stays idle.
        if (this.connectedPeers.length > 0) return;
        this.signaling.publish({ kind: "announce", from: this.peerId });
      }, d),
    );
  }

  private onSignal(msg: Record<string, unknown>): void {
    const from = msg.from as string | undefined;
    if (!from || from === this.peerId) return; // ignore our own fan-out
    const kind = msg.kind as string | undefined;

    if (kind === "announce") {
      // Broadcast announce from a (re)joining peer: reply so they can pick us
      // as a seed, but don't start a handshake — they drive the bootstrap.
      this.signaling.publish({ kind: "here", from: this.peerId, to: from });
    } else if (kind === "here" && msg.to === this.peerId) {
      // A peer told us they exist. Use the first responder as our seed; the
      // rest of the mesh is discovered peer-to-peer via PEX.
      this.onSeedCandidate(from);
    } else if (kind === "connect" && msg.to === this.peerId) {
      // The seed handshake request: connect over the relay (bootstrap path).
      this.maybeInitiate(from, undefined);
    } else if (kind === "bye") {
      this.teardown(from, true);
    } else if (kind === "webrtc" && msg.to === this.peerId) {
      const sig = msg.signal as { kind: WebrtcKind; data: unknown } | undefined;
      if (sig) void this.handleSignal(from, sig.kind, sig.data, undefined);
    }
  }

  /** First relay responder becomes the seed; bootstrap a single connection. */
  private onSeedCandidate(from: string): void {
    if (this.connections.has(from)) return;
    if (this.seeded || this.connectedPeers.length > 0) return;
    this.seeded = true;
    // Ask the seed to connect (covers the case where it has the lower id and
    // must send the offer), and try to initiate ourselves if we're the lower.
    this.signaling.publish({ kind: "connect", from: this.peerId, to: from });
    this.maybeInitiate(from, undefined);
  }

  /** Deterministic tie-break so exactly one side creates the offer. */
  private shouldInitiate(peerId: string): boolean {
    return this.peerId < peerId;
  }

  /** Start an offer toward `peerId` if we're the designated initiator and not
   * already connecting. `broker` is the neighbour to relay through (undefined
   * = use the public relay, i.e. the bootstrap/fallback path). */
  private maybeInitiate(peerId: string, broker: string | undefined): void {
    if (this.connections.has(peerId)) return;
    if (this.shouldInitiate(peerId)) void this.initiate(peerId, broker);
  }

  /** Route a handshake signal to `to`: through a connected broker when we have
   * one, otherwise over the public relay (bootstrap + fallback). */
  private routeSignal(to: string, kind: WebrtcKind, data: unknown): void {
    const broker = this.brokerFor.get(to);
    const brokerConn = broker ? this.connections.get(broker) : undefined;
    if (broker && broker !== to && brokerConn?.open) {
      this.sendMesh(broker, {
        t: "sig",
        to,
        from: this.peerId,
        sig: { kind, data },
      });
      return;
    }
    this.signaling.publish({
      kind: "webrtc",
      from: this.peerId,
      to,
      signal: { kind, data },
    });
  }

  // --- peer exchange (PEX) + brokered handshake -----------------------------

  private sendMesh(peerId: string, obj: Record<string, unknown>): boolean {
    return this.sendTo(peerId, CHANNEL_MESH, enc.encode(JSON.stringify(obj)));
  }

  /** Tell every neighbour the current membership so they can mesh with peers
   * they don't yet know, brokered through us. */
  private gossipPeers(): void {
    const peers = this.connectedPeers;
    for (const peerId of peers) {
      this.sendMesh(peerId, {
        t: "pex",
        peers: peers.filter((p) => p !== peerId),
      });
    }
  }

  private onMeshControl(deliveredBy: string, payload: Uint8Array): void {
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(dec.decode(payload)) as Record<string, unknown>;
    } catch {
      return;
    }
    const t = msg.t as string | undefined;

    if (t === "pex") {
      const peers = (msg.peers as string[] | undefined) ?? [];
      for (const p of peers) {
        if (p === this.peerId || this.connections.has(p)) continue;
        // Connect to this newly-learned peer, brokered through the neighbour
        // that told us about it (it is connected to both of us).
        this.maybeInitiate(p, deliveredBy);
      }
    } else if (t === "sig") {
      const to = msg.to as string | undefined;
      const from = msg.from as string | undefined;
      if (!to || !from) return;
      if (to === this.peerId) {
        // The neighbour that delivered this is our return path to `from`.
        if (!this.connections.get(from)?.open) this.brokerFor.set(from, deliveredBy);
        const sig = msg.sig as { kind: WebrtcKind; data: unknown } | undefined;
        if (sig) void this.handleSignal(from, sig.kind, sig.data, deliveredBy);
      } else {
        // One-hop forward toward the destination if we're connected to it.
        this.sendMesh(to, msg);
      }
    }
  }

  // --- connection setup -----------------------------------------------------

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
      if (e.candidate) this.routeSignal(peerId, "candidate", e.candidate.toJSON());
    };
    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      if (state === "failed" || state === "closed") {
        // Terminal: drop it so we can re-learn this peer (and re-seed if alone).
        this.teardown(peerId, true);
      } else if (state === "disconnected" && conn.open) {
        // Possibly transient (ICE blip); keep the entry but mark it not open.
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
      if (conn.brokerTimer) {
        clearTimeout(conn.brokerTimer);
        conn.brokerTimer = undefined;
      }
      // Once a direct link is up we no longer need a broker to reach this peer.
      this.brokerFor.delete(peerId);
      this.events.onPeerOpen?.(peerId);
      this.events.onPeersChange?.(this.connectedPeers);
      // Share membership so this peer and our other neighbours mesh up P2P.
      this.gossipPeers();
    };
    channel.onclose = () => {
      if (conn.open) {
        conn.open = false;
        this.events.onPeerClose?.(peerId);
      }
    };
    channel.onmessage = (e) => {
      const buf = new Uint8Array(e.data as ArrayBuffer);
      const tag = buf[0];
      const payload = buf.subarray(1);
      if (tag === CHANNEL_MESH) {
        this.onMeshControl(peerId, payload);
        return;
      }
      const set = this.handlers.get(tag);
      if (set) for (const h of set) h(peerId, payload);
    };
  }

  private async initiate(
    peerId: string,
    broker: string | undefined,
  ): Promise<void> {
    if (this.connections.has(peerId)) return;
    if (broker) this.brokerFor.set(peerId, broker);
    const conn = this.createConnection(peerId);
    const channel = conn.pc.createDataChannel("tt", { ordered: true });
    this.bindChannel(peerId, conn, channel);
    // If we tried to broker through the mesh and it doesn't open in time, fall
    // back to the public relay so connectivity never depends on a third hop.
    if (broker) {
      conn.brokerTimer = setTimeout(() => {
        if (this.stopped || conn.open) return;
        this.brokerFor.delete(peerId);
        this.teardown(peerId);
        this.signaling.publish({ kind: "connect", from: this.peerId, to: peerId });
        this.maybeInitiate(peerId, undefined);
      }, BROKER_FALLBACK_MS);
    }
    const offer = await conn.pc.createOffer();
    await conn.pc.setLocalDescription(offer);
    this.routeSignal(peerId, "offer", offer);
  }

  private async handleSignal(
    from: string,
    kind: WebrtcKind,
    data: unknown,
    broker: string | undefined,
  ): Promise<void> {
    let conn = this.connections.get(from);

    if (kind === "offer") {
      if (!conn) conn = this.createConnection(from);
      if (broker) this.brokerFor.set(from, broker);
      await conn.pc.setRemoteDescription(data as RTCSessionDescriptionInit);
      conn.remoteSet = true;
      await this.flushCandidates(conn);
      const answer = await conn.pc.createAnswer();
      await conn.pc.setLocalDescription(answer);
      this.routeSignal(from, "answer", answer);
    } else if (kind === "answer") {
      if (!conn) return;
      await conn.pc.setRemoteDescription(data as RTCSessionDescriptionInit);
      conn.remoteSet = true;
      await this.flushCandidates(conn);
    } else if (kind === "candidate") {
      if (!conn) return;
      const cand = data as RTCIceCandidateInit;
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
    if (conn.brokerTimer) clearTimeout(conn.brokerTimer);
    conn.channel?.close();
    conn.pc.close();
    this.connections.delete(peerId);
    this.brokerFor.delete(peerId);
    if (emitClose && wasOpen) {
      this.events.onPeerClose?.(peerId);
      this.events.onPeersChange?.(this.connectedPeers);
    }
    this.maybeReseed();
  }

  /** If we've fallen out of the mesh entirely, look for a fresh seed. */
  private maybeReseed(): void {
    if (this.stopped || this.connections.size > 0) return;
    this.seeded = false;
    this.announceBurst();
  }
}
