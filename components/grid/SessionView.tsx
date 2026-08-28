"use client";

import { CapabilityPanel } from "@/components/grid/CapabilityPanel";
import { InferenceConsole } from "@/components/grid/InferenceConsole";
import { InviteBar } from "@/components/grid/InviteBar";
import { ModelPanel } from "@/components/grid/ModelPanel";
import { OnboardingTour } from "@/components/grid/OnboardingTour";
import { PeerList } from "@/components/grid/PeerList";
import { RecoveryBanner } from "@/components/grid/RecoveryBanner";
import { TelemetryStrip } from "@/components/grid/TelemetryStrip";
import { useGridNode } from "@/lib/grid/useGridNode";

export function SessionView({ roomId }: { roomId: string }) {
  const { node, snapshot } = useGridNode(roomId);

  return (
    <main className="flex-1">
      <OnboardingTour />
      <InviteBar roomId={roomId} connected={snapshot.connected} node={node} />

      <div className="mx-auto grid max-w-6xl gap-5 px-6 py-6 lg:grid-cols-[360px_1fr]">
        <div className="space-y-5">
          <TelemetryStrip snapshot={snapshot} />
          <RecoveryBanner node={node} snapshot={snapshot} />
          <ModelPanel node={node} snapshot={snapshot} />
          <CapabilityPanel snapshot={snapshot} />
          <PeerList peers={snapshot.peers} />
        </div>

        <div className="min-h-[70vh]">
          <InferenceConsole node={node} snapshot={snapshot} roomId={roomId} />
        </div>
      </div>
    </main>
  );
}
