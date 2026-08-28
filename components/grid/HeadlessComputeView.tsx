"use client";

import { TelemetryStrip } from "@/components/grid/TelemetryStrip";
import { ModelPanel } from "@/components/grid/ModelPanel";
import { PeerList } from "@/components/grid/PeerList";
import { RecoveryBanner } from "@/components/grid/RecoveryBanner";
import { GatewayBridge } from "@/components/gateway/GatewayBridge";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { useGridNode } from "@/lib/grid/useGridNode";

/**
 * Minimal always-on compute view — donate WebGPU to the mesh without chat UI.
 * Open `/s?r=<room>&headless=1` or pass `?mode=compute`.
 */
export function HeadlessComputeView({ roomId }: { roomId: string }) {
  const { node, snapshot } = useGridNode(roomId);
  const gwPort = typeof window !== "undefined" ? window.teamthinkDesktop?.gateway?.port : undefined;

  return (
    <main className="flex-1">
      <GatewayBridge node={node} />
      <div className="mx-auto max-w-xl space-y-5 px-6 py-10">
        <div className="text-center">
          <Badge tone="positive" dot>
            Compute node
          </Badge>
          <h1 className="mt-3 font-display text-2xl text-ink">Headless mode</h1>
          <p className="mt-2 text-sm text-ink-muted">
            This tab stays connected to room{" "}
            <span className="font-mono text-ink">{roomId}</span> and serves
            inference to peers. Keep it open to donate WebGPU compute.
          </p>
          {gwPort != null && (
            <p className="mt-2 text-xs text-ink-subtle">
              OpenAI gateway:{" "}
              <span className="font-mono text-ink">http://127.0.0.1:{gwPort}/v1</span>
            </p>
          )}
        </div>

        <TelemetryStrip snapshot={snapshot} />
        <RecoveryBanner node={node} snapshot={snapshot} />
        <ModelPanel node={node} snapshot={snapshot} />

        <Card>
          <CardHeader>
            <CardTitle>Pool peers</CardTitle>
          </CardHeader>
          <PeerList peers={snapshot.peers} />
        </Card>
      </div>
    </main>
  );
}
