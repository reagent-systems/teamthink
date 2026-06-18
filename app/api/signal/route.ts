import { NextRequest, NextResponse } from "next/server";
import {
  getSignalingStore,
  type SignalMessage,
} from "@/lib/server/signaling-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body =
  | { action: "join"; roomId: string; peerId: string }
  | { action: "leave"; roomId: string; peerId: string }
  | {
      action: "poll";
      roomId: string;
      peerId: string;
    }
  | {
      action: "send";
      roomId: string;
      message: SignalMessage;
    }
  | { action: "snapshot:save"; roomId: string; snapshot: string }
  | { action: "snapshot:load"; roomId: string };

/**
 * Signaling mailbox. Peers register presence, discover other peers, exchange
 * SDP/ICE through per-peer inboxes, and optionally persist a CRDT snapshot for
 * late joiners. Designed for short-polling so it works on serverless (no
 * long-lived sockets).
 */
export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const store = getSignalingStore();

  switch (body.action) {
    case "join": {
      await store.registerPeer(body.roomId, body.peerId);
      const peers = (await store.listPeers(body.roomId)).filter(
        (p) => p !== body.peerId,
      );
      return NextResponse.json({ peers });
    }

    case "leave": {
      await store.removePeer(body.roomId, body.peerId);
      return NextResponse.json({ ok: true });
    }

    case "poll": {
      // Refresh presence, return inbox messages and the current peer list so
      // peers can detect newcomers.
      await store.registerPeer(body.roomId, body.peerId);
      const [messages, peers] = await Promise.all([
        store.drain(body.roomId, body.peerId),
        store.listPeers(body.roomId),
      ]);
      return NextResponse.json({
        messages,
        peers: peers.filter((p) => p !== body.peerId),
      });
    }

    case "send": {
      await store.push(body.roomId, body.message);
      return NextResponse.json({ ok: true });
    }

    case "snapshot:save": {
      await store.saveSnapshot(body.roomId, body.snapshot);
      return NextResponse.json({ ok: true });
    }

    case "snapshot:load": {
      const snapshot = await store.loadSnapshot(body.roomId);
      return NextResponse.json({ snapshot });
    }

    default:
      return NextResponse.json({ error: "unknown action" }, { status: 400 });
  }
}
