"use client";

import { Stat } from "@/components/ui/Stat";
import type { GridSnapshot } from "@/lib/grid/types";

/** Live session health: queue, throughput, and peer RTT. */
export function TelemetryStrip({ snapshot }: { snapshot: GridSnapshot }) {
  const { telemetry, pipelines } = snapshot;
  const running = pipelines.find((p) => p.status === "running");
  const tok =
    telemetry.tokensPerSec ?? running?.tokensPerSec ?? null;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Stat
        label="Queue"
        value={telemetry.queueDepth}
        hint={telemetry.activeJobCount ? `${telemetry.activeJobCount} active` : undefined}
      />
      <Stat
        label="Tok/s"
        value={tok != null ? tok.toFixed(1) : "—"}
      />
      <Stat
        label="Median RTT"
        value={
          telemetry.medianRttMs != null
            ? `${Math.round(telemetry.medianRttMs)} ms`
            : "—"
        }
      />
      <Stat
        label="Shard hops"
        value={
          snapshot.provisioned && snapshot.provisioned.numShards > 1
            ? snapshot.provisioned.numShards - 1
            : snapshot.provisioned?.numShards === 1
              ? 0
              : "—"
        }
        hint={
          snapshot.provisioned
            ? `${snapshot.provisioned.readyCount}/${snapshot.provisioned.numShards || 1} warm`
            : undefined
        }
      />
    </div>
  );
}
