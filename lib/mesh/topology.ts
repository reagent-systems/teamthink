/**
 * Partial-mesh peer selection — limit WebRTC degree for large rooms (ROADMAP #62).
 */

/** Max direct P2P connections per peer (gossip-style partial mesh). */
export const MAX_MESH_DEGREE = 8;

/** Deterministic score for whether two peers should connect (lower = prefer). */
export function peerAffinity(localId: string, remoteId: string, roomId: string): number {
  const key = `${roomId}:${localId}:${remoteId}`;
  let h = 0;
  for (let i = 0; i < key.length; i++) {
    h = (h * 31 + key.charCodeAt(i)) >>> 0;
  }
  return h;
}

/** Pick up to `limit` peers to maintain direct links with. */
export function selectMeshPeers(
  selfId: string,
  candidates: string[],
  roomId: string,
  limit = MAX_MESH_DEGREE,
): Set<string> {
  const sorted = [...candidates]
    .filter((p) => p !== selfId)
    .sort((a, b) => peerAffinity(selfId, a, roomId) - peerAffinity(selfId, b, roomId));
  return new Set(sorted.slice(0, limit));
}

/** Whether `localId` should initiate toward `remoteId` given current degree budget. */
export function shouldConnectPeer(
  localId: string,
  remoteId: string,
  roomId: string,
  allPeers: string[],
  connectedCount: number,
  maxDegree = MAX_MESH_DEGREE,
): boolean {
  if (localId === remoteId) return false;
  if (connectedCount >= maxDegree) return false;
  const targets = selectMeshPeers(localId, allPeers, roomId, maxDegree);
  return targets.has(remoteId) && localId < remoteId;
}
