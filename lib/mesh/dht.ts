/**
 * Swarm discovery via the pool registry (ROADMAP #63).
 */

import { POOLS_URL } from "@/lib/config";

export interface SwarmEntry {
  room: string;
  peers: number;
  updatedAt: number;
}

export async function discoverSwarms(): Promise<SwarmEntry[]> {
  if (!POOLS_URL) return [];
  const res = await fetch(POOLS_URL);
  const data = (await res.json()) as { pools?: SwarmEntry[] };
  return data.pools ?? [];
}

export function pickSwarmForModel(
  swarms: SwarmEntry[],
  _modelId: string,
): SwarmEntry | null {
  if (!swarms.length) return null;
  return [...swarms].sort((a, b) => b.peers - a.peers)[0] ?? null;
}
