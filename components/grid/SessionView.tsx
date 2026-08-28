"use client";

import { useState } from "react";
import { DocumentPanel } from "@/components/rag/DocumentPanel";
import { ToolsPanel } from "@/components/tools/ToolsPanel";
import { KnowledgeBasePanel } from "@/components/kb/KnowledgeBasePanel";
import { McpPanel } from "@/components/mcp/McpPanel";
import { WebToolsPanel } from "@/components/scrape/WebToolsPanel";
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
import { DeviceRoutingPanel } from "@/components/grid/DeviceRoutingPanel";
import { SignInPanel } from "@/components/auth/SignInPanel";
import { ProfilePanel } from "@/components/platform/ProfilePanel";
import { NotificationsPanel } from "@/components/platform/NotificationsPanel";
import { HybridFallbackPanel } from "@/components/platform/HybridFallbackPanel";
import { IntegrationsPanel } from "@/components/integrations/IntegrationsPanel";
import { EvalPanel } from "@/components/eval/EvalPanel";
import { MarketplacePanel } from "@/components/marketplace/MarketplacePanel";
import { ObservabilityPanel } from "@/components/observability/ObservabilityPanel";
import { McpExportPanel } from "@/components/mcp/McpExportPanel";
import type { McpToolRoute } from "@/lib/mcp/client";
import type { RagSearchMode } from "@/lib/rag/store";
import type { ToolDefinition } from "@/lib/tools/types";
import { useGridNode } from "@/lib/grid/useGridNode";
import { useRoomPlatform } from "@/hooks/useRoomPlatform";
import { meshIsCold } from "@/lib/platform/hybrid";

export function SessionView({ roomId }: { roomId: string }) {
  const { node, snapshot } = useGridNode(roomId);
  const legacyRole =
    snapshot.peers.find((p) => p.self)?.roomRole ?? "request";
  const { membershipRole, permissions, remoteConfig } = useRoomPlatform(
    roomId,
    legacyRole,
  );
  const [pickModelId, setPickModelId] = useState<string | null>(null);
  const [registryVersion, setRegistryVersion] = useState(0);
  const [ragEnabled, setRagEnabled] = useState(false);
  const [ragSearchMode, setRagSearchMode] = useState<RagSearchMode>("hybrid");
  const [toolsEnabled, setToolsEnabled] = useState(false);
  const [mcpEnabled, setMcpEnabled] = useState(false);
  const [mcpTools, setMcpTools] = useState<ToolDefinition[]>([]);
  const [mcpRoutes, setMcpRoutes] = useState<Map<string, McpToolRoute>>(
    () => new Map(),
  );
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [webEnabled, setWebEnabled] = useState(
    () => remoteConfig?.featureFlags.webTools ?? true,
  );
  const [agentMode, setAgentMode] = useState(
    () => remoteConfig?.featureFlags.agentMode ?? false,
  );

  const meshCold = meshIsCold(snapshot.peers.length, !!snapshot.provisioned);

  function selectModel(id: string, hfRepo: string) {
    if (!permissions.canProvision) return;
    setPickModelId(id);
    setRegistryVersion((v) => v + 1);
    void node.provision(id, hfRepo);
  }

  return (
    <main className="flex-1">
      <GatewayBridge node={node} />
      <OnboardingTour />
      <InviteBar
        roomId={roomId}
        connected={snapshot.connected}
        node={node}
        membershipRole={membershipRole}
        canInvite={permissions.canInvite}
      />

      <div className="mx-auto grid max-w-6xl gap-5 px-6 py-6 lg:grid-cols-[360px_1fr]">
        <div className="space-y-5">
          <TelemetryStrip snapshot={snapshot} />
          <RecoveryBanner node={node} snapshot={snapshot} />
          <SignInPanel />
          <ProfilePanel membershipRole={membershipRole} />
          <NotificationsPanel />
          {(remoteConfig?.hybridFallbackEnabled ?? true) && (
            <HybridFallbackPanel meshCold={meshCold} />
          )}
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
          {(remoteConfig?.featureFlags.webTools ?? true) && (
            <WebToolsPanel
              roomId={roomId}
              webEnabled={webEnabled}
              onWebEnabledChange={setWebEnabled}
              agentMode={agentMode}
              onAgentModeChange={setAgentMode}
            />
          )}
          {(remoteConfig?.featureFlags.mcp ?? true) && (
            <McpPanel
              roomId={roomId}
              enabled={mcpEnabled}
              onEnabledChange={setMcpEnabled}
              onToolsChange={(tools, routes) => {
                setMcpTools(tools);
                setMcpRoutes(routes);
              }}
            />
          )}
          <ToolsPanel enabled={toolsEnabled} onEnabledChange={setToolsEnabled} />
          <KnowledgeBasePanel roomId={roomId} />
          {(remoteConfig?.featureFlags.integrations ?? true) && (
            <IntegrationsPanel roomId={roomId} />
          )}
          {(remoteConfig?.featureFlags.mcpExport ?? true) && (
            <McpExportPanel roomId={roomId} />
          )}
          {(remoteConfig?.featureFlags.eval ?? true) && (
            <EvalPanel roomId={roomId} node={node} />
          )}
          {(remoteConfig?.featureFlags.marketplace ?? true) && (
            <MarketplacePanel />
          )}
          {(remoteConfig?.featureFlags.observability ?? true) && (
            <ObservabilityPanel />
          )}
          <CapabilityPanel snapshot={snapshot} />
          <DeviceRoutingPanel roomId={roomId} peers={snapshot.peers} />
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
            mcpEnabled={mcpEnabled}
            mcpTools={mcpTools}
            mcpRoutes={mcpRoutes}
            webEnabled={webEnabled}
            agentMode={agentMode}
            ttsEnabled={ttsEnabled}
            onTtsEnabledChange={setTtsEnabled}
            canSubmit={permissions.canSubmitPrompt}
            meshCold={meshCold}
          />
        </div>
      </div>
    </main>
  );
}
