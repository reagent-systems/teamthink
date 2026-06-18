"use client";

import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import type { PeerPresence } from "@/lib/grid/types";

export function PeerList({ peers }: { peers: PeerPresence[] }) {
  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <CardTitle>Nodes</CardTitle>
        <Badge tone="neutral">{peers.length} online</Badge>
      </CardHeader>
      <ul className="space-y-2">
        {peers.map((p) => (
          <li
            key={p.peerId}
            className="flex items-center justify-between rounded-xl border border-border bg-surface-sunken px-4 py-3"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm text-ink">
                  {p.peerId.slice(0, 8)}
                </span>
                {p.self && <Badge tone="accent">you</Badge>}
                <Badge tone={p.caps.webgpu ? "positive" : "neutral"} dot>
                  {p.caps.webgpu ? "compute" : "consume"}
                </Badge>
              </div>
              <div className="mt-1 truncate text-xs text-ink-muted">
                {p.caps.webgpu
                  ? `${p.caps.gpuVendor ?? "GPU"} · ~${formatMb(
                      p.caps.memoryEstimateMb,
                    )} · ${p.loadedModels.length} model(s) loaded`
                  : "no WebGPU — request-only"}
              </div>
            </div>
            <div className="shrink-0 text-right">
              <div className="font-display text-lg text-ink tabular-nums">
                {p.activeJobs}
              </div>
              <div className="text-[10px] uppercase tracking-wide text-ink-subtle">
                active
              </div>
            </div>
          </li>
        ))}
        {peers.length === 0 && (
          <li className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-ink-subtle">
            No nodes yet.
          </li>
        )}
      </ul>
    </Card>
  );
}

function formatMb(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${Math.round(mb)} MB`;
}
