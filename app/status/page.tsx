"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { POOLS_URL, WORKER_HTTP_URL } from "@/lib/config";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

export default function StatusPage() {
  const [pools, setPools] = useState(0);
  const [peers, setPeers] = useState(0);
  const [workerUp, setWorkerUp] = useState<boolean | null>(() =>
    POOLS_URL ? null : false,
  );

  useEffect(() => {
    if (!POOLS_URL) return;
    void fetch(POOLS_URL)
      .then((r) => r.json())
      .then((d: { pools?: { peers: number }[] }) => {
        const list = d.pools ?? [];
        setPools(list.length);
        setPeers(list.reduce((s, p) => s + p.peers, 0));
        setWorkerUp(true);
      })
      .catch(() => setWorkerUp(false));
  }, []);

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-6 py-10">
      <Link href="/" className="text-sm text-ink-muted hover:text-accent">
        ← Home
      </Link>
      <h1 className="font-display text-2xl text-ink">Service status</h1>
      <p className="text-ink-muted">Managed signaling SLA dashboard (ROADMAP #96).</p>

      <div className="flex flex-wrap gap-3">
        <Badge tone={workerUp ? "positive" : "neutral"}>
          Signaling {workerUp ? "operational" : "offline"}
        </Badge>
        <Badge tone="neutral">{pools} live pools</Badge>
        <Badge tone="neutral">{peers} peers</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Components</CardTitle>
        </CardHeader>
        <ul className="space-y-2 text-sm text-ink-muted">
          <li>Static app — CDN hosted</li>
          <li>
            Worker — {WORKER_HTTP_URL || "not configured"}
          </li>
          <li>Desktop gateway — local :11434 when app is running</li>
          <li>Target uptime — 99.9% (managed signaling)</li>
        </ul>
      </Card>
    </main>
  );
}
