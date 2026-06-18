import { NextRequest, NextResponse } from "next/server";
import { generateRoomId } from "@/lib/id";
import { getSignalingStore } from "@/lib/server/signaling-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Create a new session room. Rooms are implicit; this just mints an id. */
export async function POST() {
  const roomId = generateRoomId();
  return NextResponse.json({ roomId });
}

/** Report whether a room currently has any present peers. */
export async function GET(req: NextRequest) {
  const roomId = req.nextUrl.searchParams.get("roomId");
  if (!roomId) {
    return NextResponse.json({ error: "roomId required" }, { status: 400 });
  }
  const store = getSignalingStore();
  const peers = await store.listPeers(roomId);
  return NextResponse.json({ roomId, peerCount: peers.length });
}
