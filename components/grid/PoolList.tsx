"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { POOLS_URL } from "@/lib/config";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

interface Pool {
  room: string;
  peers: number;
  updatedAt: number;
}

/**
 * Lists the live pools advertised by the signaling Worker's registry. Fetched
 * on mount (and on demand) — not polled. Joining a pool just opens its session
 * link; the actual connect happens peer-to-peer via the mesh.
 */
export function PoolList() {
  const router = useRouter();
  const [pools, setPools] = useState<Pool[] | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchPools = useCallback(async (): Promise<Pool[]> => {
    const res = await fetch(POOLS_URL, { cache: "no-store" });
    const data = (await res.json()) as { pools?: Pool[] };
    return data.pools ?? [];
  }, []);

  useEffect(() => {
    if (!POOLS_URL) return;
    let cancelled = false;
    fetchPools()
      .then((p) => {
        if (!cancelled) setPools(p);
      })
      .catch(() => {
        if (!cancelled) setPools([]);
      });
    return () => {
      cancelled = true;
    };
  }, [fetchPools]);

  const refresh = useCallback(async () => {
    if (!POOLS_URL) return;
    setLoading(true);
    try {
      setPools(await fetchPools());
    } catch {
      setPools([]);
    } finally {
      setLoading(false);
    }
  }, [fetchPools]);

  if (!POOLS_URL) return null;

  return (
    <section className="mt-12 animate-fade-in">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg text-ink">Live pools</h3>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => void refresh()}
          disabled={loading}
        >
          {loading ? "Refreshing…" : "Refresh"}
        </Button>
      </div>

      {pools && pools.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {pools.map((p) => (
            <li
              key={p.room}
              className="flex items-center justify-between rounded-2xl border border-border bg-surface px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <span className="font-mono text-sm text-ink">{p.room}</span>
                <Badge tone="neutral" dot>
                  {p.peers} {p.peers === 1 ? "node" : "nodes"}
                </Badge>
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => router.push(`/s?r=${p.room}`)}
              >
                Join
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-ink-muted">
          {pools === null ? "Loading…" : "No pools are live right now."}
        </p>
      )}
    </section>
  );
}
