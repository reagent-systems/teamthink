"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { POOLS_URL } from "@/lib/config";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

interface PoolEntry {
  room: string;
  peers: number;
  updatedAt: number;
}

export default function HealthPage() {
  const [pools, setPools] = useState<PoolEntry[]>([]);
  const [error, setError] = useState<string | null>(() =>
    POOLS_URL ? null : "Set NEXT_PUBLIC_SIGNAL_WS_URL to load swarm health",
  );

  useEffect(() => {
    if (!POOLS_URL) return;
    void fetch(POOLS_URL)
      .then((r) => r.json())
      .then((d: { pools?: PoolEntry[] }) => setPools(d.pools ?? []))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed"));
  }, []);

  const totalPeers = pools.reduce((s, p) => s + p.peers, 0);

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-6 py-10">
      <Link href="/" className="text-sm text-ink-muted hover:text-accent">
        ← Home
      </Link>
      <h1 className="font-display text-2xl text-ink">Swarm health</h1>
      <p className="text-ink-muted">
        Live pools from the signaling registry (Petals-style capacity view).
      </p>

      <div className="flex flex-wrap gap-3">
        <Badge tone="positive">{pools.length} live pools</Badge>
        <Badge tone="neutral">{totalPeers} connected peers</Badge>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <Card>
        <CardHeader>
          <CardTitle>Active pools</CardTitle>
        </CardHeader>
        <ul className="space-y-2 font-mono text-sm">
          {pools.length === 0 && !error && (
            <li className="text-ink-muted">No live pools</li>
          )}
          {pools.map((p) => (
            <li
              key={p.room}
              className="flex justify-between gap-4 rounded-lg border border-border px-3 py-2"
            >
              <span>{p.room}</span>
              <span className="text-ink-muted">
                {p.peers} peer{p.peers === 1 ? "" : "s"}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </main>
  );
}
