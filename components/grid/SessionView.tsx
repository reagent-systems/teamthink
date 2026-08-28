"use client";

import { useState } from "react";
import { DocumentPanel } from "@/components/rag/DocumentPanel";
import { ToolsPanel } from "@/components/tools/ToolsPanel";
import { GatewayBridge } from "@/components/gateway/GatewayBridge";
import { CapabilityPanel } from "@/components/grid/CapabilityPanel";
import { InferenceConsole } from "@/components/grid/InferenceConsole";
import { InviteBar } from "@/components/grid/InviteBar";
import { ModelBrowser } from "@/components/grid/ModelBrowser";
import { ModelPanel } from "@/components/grid/ModelPanel";
import { OnboardingTour } from "@/components/grid/OnboardingTour";
import { PeerList } from "@/components/grid/PeerList";
import { RecoveryBanner } from "@/components/grid/RecoveryBanner";
import { TelemetryStrip } from "@/components/grid/TelemetryStrip";
import type { RagSearchMode } from "@/lib/rag/store";
import { useGridNode } from "@/lib/grid/useGridNode";

export function SessionView({ roomId }: { roomId: string }) {
  const { node, snapshot } = useGridNode(roomId);
  const [pickModelId, setPickModelId] = useState<string | null>(null);
  const [registryVersion, setRegistryVersion] = useState(0);
  const [ragEnabled, setRagEnabled] = useState(false);
  const [ragSearchMode, setRagSearchMode] = useState<RagSearchMode>("hybrid");
  const [toolsEnabled, setToolsEnabled] = useState(false);

  function selectModel(id: string, hfRepo: string) {
    setPickModelId(id);
    setRegistryVersion((v) => v + 1);
    void node.provision(id, hfRepo);
  }

  return (
    <main className="flex-1">
      <GatewayBridge node={node} />
      <OnboardingTour />
      <InviteBar roomId={roomId} connected={snapshot.connected} node={node} />

      <div className="mx-auto grid max-w-6xl gap-5 px-6 py-6 lg:grid-cols-[360px_1fr]">
        <div className="space-y-5">
          <TelemetryStrip snapshot={snapshot} />
          <RecoveryBanner node={node} snapshot={snapshot} />
          <ModelPanel node={node} snapshot={snapshot} />
          <ModelBrowser
            snapshot={snapshot}
            selectedId={pickModelId ?? snapshot.provisioned?.modelId ?? null}
            onSelect={selectModel}
          />
          <DocumentPanel
            roomId={roomId}
            ragEnabled={ragEnabled}
            onRagEnabledChange={setRagEnabled}
            ragSearchMode={ragSearchMode}
            onRagSearchModeChange={setRagSearchMode}
          />
          <ToolsPanel enabled={toolsEnabled} onEnabledChange={setToolsEnabled} />
          <CapabilityPanel snapshot={snapshot} />
          <PeerList peers={snapshot.peers} />
        </div>

        <div className="min-h-[70vh]">
          <InferenceConsole
            node={node}
            snapshot={snapshot}
            roomId={roomId}
            pickModelId={pickModelId}
            registryVersion={registryVersion}
            onManualModelChange={() => setPickModelId(null)}
            ragEnabled={ragEnabled}
            ragSearchMode={ragSearchMode}
            toolsEnabled={toolsEnabled}
          />
        </div>
      </div>
    </main>
  );
}
