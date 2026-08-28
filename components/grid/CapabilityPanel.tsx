"use client";

import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import type { GridSnapshot } from "@/lib/grid/types";

/** WebGPU adapter details and mesh connectivity for this device. */
export function CapabilityPanel({ snapshot }: { snapshot: GridSnapshot }) {
  const { caps, connected, peers } = snapshot;
  const meshDirect = connected;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Capabilities</CardTitle>
      </CardHeader>

      {!caps && <p className="text-sm text-ink-muted">Detecting hardware…</p>}

      {caps && (
        <dl className="space-y-2 text-sm">
          <Row label="WebGPU">
            <Badge tone={caps.webgpu ? "positive" : "neutral"} dot>
              {caps.webgpu ? "available" : "unavailable"}
            </Badge>
          </Row>
          {!caps.webgpu && (
            <Row label="CPU fallback">
              <Badge tone="warning">request-only</Badge>
            </Row>
          )}
          {caps.gpuVendor && (
            <Row label="GPU vendor">
              <span className="text-ink-muted">{caps.gpuVendor}</span>
            </Row>
          )}
          {caps.gpuArchitecture && (
            <Row label="Architecture">
              <span className="font-mono text-xs text-ink-muted">
                {caps.gpuArchitecture}
              </span>
            </Row>
          )}
          <Row label="Shader f16">
            <Badge tone={caps.shaderF16 ? "positive" : "neutral"}>
              {caps.shaderF16 ? "yes" : "no"}
            </Badge>
          </Row>
          <Row label="Est. usable VRAM">
            <span className="tabular-nums text-ink-muted">
              ~{formatMb(caps.memoryEstimateMb)}
            </span>
          </Row>
          {caps.deviceMemoryGb != null && (
            <Row label="System RAM hint">
              <span className="tabular-nums text-ink-muted">
                {caps.deviceMemoryGb} GB
              </span>
            </Row>
          )}
          <Row label="Compatible models">
            <span className="tabular-nums text-ink-muted">
              {caps.compatibleModelIds.length}
            </span>
          </Row>
          <Row label="Mesh">
            <Badge tone={meshDirect ? "positive" : "neutral"} dot>
              {meshDirect
                ? `P2P · ${peers.length} peer(s)`
                : "waiting for peers"}
            </Badge>
          </Row>
          <Row label="NAT / TURN">
            <span className="text-xs text-ink-muted">
              {meshDirect
                ? "direct WebRTC (no relay)"
                : "signaling only until peers connect"}
            </span>
          </Row>
        </dl>
      )}
    </Card>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-ink-subtle">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function formatMb(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${Math.round(mb)} MB`;
}
