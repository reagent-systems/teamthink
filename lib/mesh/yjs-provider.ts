import * as Y from "yjs";
import { CHANNEL_CRDT, MeshClient } from "@/lib/mesh/peer";

/**
 * Minimal Yjs provider over the WebRTC mesh. Replicates a single Y.Doc across
 * all peers using a tiny sync protocol built on Yjs core primitives:
 *
 *   byte 0 = message type
 *     0 SYNC_STEP1  -> sender's state vector (request missing updates)
 *     1 SYNC_UPDATE -> a Yjs update (diff or full)
 *
 * On a new peer we send STEP1; the receiver replies with the diff the peer is
 * missing. Local doc changes are broadcast as SYNC_UPDATE.
 */

const SYNC_STEP1 = 0;
const SYNC_UPDATE = 1;

export class MeshYjsProvider {
  private unsubFrame: () => void;
  private unsubDoc: () => void;
  private originTag = {};

  constructor(
    private mesh: MeshClient,
    readonly doc: Y.Doc,
  ) {
    this.unsubFrame = mesh.on(CHANNEL_CRDT, (peerId, payload) =>
      this.onFrame(peerId, payload),
    );
    const onUpdate = (update: Uint8Array, origin: unknown) => {
      // Avoid echoing updates we just applied from the network.
      if (origin === this.originTag) return;
      this.broadcastUpdate(update);
    };
    doc.on("update", onUpdate);
    this.unsubDoc = () => doc.off("update", onUpdate);
  }

  /** Send our state vector to a freshly connected peer to trigger a diff. */
  syncWithPeer(peerId: string): void {
    const sv = Y.encodeStateVector(this.doc);
    this.mesh.sendTo(peerId, CHANNEL_CRDT, frame(SYNC_STEP1, sv));
  }

  /** Push current full state to a peer (used for cold-started joiners). */
  pushFullState(peerId: string): void {
    const update = Y.encodeStateAsUpdate(this.doc);
    this.mesh.sendTo(peerId, CHANNEL_CRDT, frame(SYNC_UPDATE, update));
  }

  destroy(): void {
    this.unsubFrame();
    this.unsubDoc();
  }

  private broadcastUpdate(update: Uint8Array): void {
    this.mesh.broadcast(CHANNEL_CRDT, frame(SYNC_UPDATE, update));
  }

  private onFrame(peerId: string, payload: Uint8Array): void {
    if (payload.length === 0) return;
    const type = payload[0];
    const body = payload.subarray(1);
    if (type === SYNC_STEP1) {
      // Reply with the updates this peer is missing.
      const diff = Y.encodeStateAsUpdate(this.doc, body);
      this.mesh.sendTo(peerId, CHANNEL_CRDT, frame(SYNC_UPDATE, diff));
    } else if (type === SYNC_UPDATE) {
      Y.applyUpdate(this.doc, body, this.originTag);
    }
  }
}

function frame(type: number, body: Uint8Array): Uint8Array {
  const out = new Uint8Array(body.length + 1);
  out[0] = type;
  out.set(body, 1);
  return out;
}
