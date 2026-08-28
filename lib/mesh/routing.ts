/**
 * Latency-aware routing and compute contribution scoring (ROADMAP #64, #69).
 */

export interface PeerScore {
  peerId: string;
  rttMs: number;
  tokensServed: number;
  uptimeMs: number;
  reliability: number;
}

export function scorePeer(
  peerId: string,
  rttMs: number,
  tokensServed: number,
  joinedAt: number,
): PeerScore {
  const uptimeMs = Math.max(0, Date.now() - joinedAt);
  const latencyScore = 1 / (1 + rttMs / 200);
  const throughputScore = Math.min(1, tokensServed / 10_000);
  const uptimeScore = Math.min(1, uptimeMs / (60 * 60 * 1000));
  const reliability = latencyScore * 0.5 + throughputScore * 0.3 + uptimeScore * 0.2;
  return { peerId, rttMs, tokensServed, uptimeMs, reliability };
}

/** Sort peers for shard routing — prefer low RTT and high reliability. */
export function rankPeersForRouting(scores: PeerScore[]): PeerScore[] {
  return [...scores].sort((a, b) => {
    if (b.reliability !== a.reliability) return b.reliability - a.reliability;
    return a.rttMs - b.rttMs;
  });
}

export function pickLowLatencyPeer(
  scores: PeerScore[],
  exclude: Set<string> = new Set(),
): string | null {
  const ranked = rankPeersForRouting(scores.filter((s) => !exclude.has(s.peerId)));
  return ranked[0]?.peerId ?? null;
}
