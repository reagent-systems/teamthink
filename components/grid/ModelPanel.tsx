"use client";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { getModel } from "@/lib/config";
import type { GridNode } from "@/lib/grid/scheduler";
import type { GridSnapshot, ProvisionedView } from "@/lib/grid/types";
import {
  setStoredLoadPolicy,
  type ModelLoadPolicy,
} from "@/lib/session/load-policy";

export function ModelPanel({
  node,
  snapshot,
}: {
  node: GridNode;
  snapshot: GridSnapshot;
}) {
  const { provisioned, modelVramMb, vramEstimateMb, loadPolicy } = snapshot;
  const loading =
    provisioned?.status === "planning" || provisioned?.status === "warming";
  const ready = provisioned?.status === "ready";
  const model = provisioned ? getModel(provisioned.modelId) : null;
  const label =
    model?.label ?? provisioned?.repo ?? provisioned?.modelId ?? "No model";
  const fits =
    modelVramMb != null && vramEstimateMb != null
      ? vramEstimateMb >= modelVramMb
      : null;

  function setPolicy(policy: ModelLoadPolicy) {
    setStoredLoadPolicy(policy);
    node.setLoadPolicy(policy);
  }

  return (
    <div className="rounded-xl border border-border bg-surface-sunken p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-ink-muted">
          Model lifecycle
        </span>
        {provisioned && (
          <Badge tone={pipelineTone[provisioned.status]} dot>
            {provisioned.status}
          </Badge>
        )}
      </div>

      {provisioned ? (
        <>
          <p className="mt-2 truncate text-sm text-ink">{label}</p>
          <VramMeter
            modelMb={modelVramMb}
            deviceMb={vramEstimateMb}
            fits={fits}
          />
          {provisioned.progress && loading && (
            <LoadProgressBar progress={provisioned.progress} />
          )}
          {provisioned.status === "error" && provisioned.error && (
            <p className="mt-2 text-xs text-danger">{provisioned.error}</p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {loading && (
              <Button size="sm" variant="secondary" onClick={() => node.cancelLoad()}>
                Cancel load
              </Button>
            )}
            {(ready || provisioned.status === "error") && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => void node.deprovision()}
              >
                Unload
              </Button>
            )}
            {provisioned.status === "error" && (
              <Button size="sm" onClick={() => void node.retryProvision()}>
                Retry
              </Button>
            )}
          </div>
        </>
      ) : (
        <p className="mt-2 text-sm text-ink-muted">
          Pick a model in the console to warm it on the grid.
        </p>
      )}

      <div className="mt-4 border-t border-border pt-3">
        <p className="text-[11px] uppercase tracking-wide text-ink-subtle">
          When idle
        </p>
        <div className="mt-2 flex gap-2">
          <PolicyButton
            active={loadPolicy === "keep-warm"}
            onClick={() => setPolicy("keep-warm")}
          >
            Keep warm
          </PolicyButton>
          <PolicyButton
            active={loadPolicy === "evict-idle"}
            onClick={() => setPolicy("evict-idle")}
          >
            Evict (15m)
          </PolicyButton>
        </div>
      </div>
    </div>
  );
}

function VramMeter({
  modelMb,
  deviceMb,
  fits,
}: {
  modelMb: number | null;
  deviceMb: number | null;
  fits: boolean | null;
}) {
  if (modelMb == null || deviceMb == null) return null;
  const pct = Math.min(100, Math.round((modelMb / deviceMb) * 100));
  return (
    <div className="mt-2">
      <div className="mb-1 flex justify-between text-[11px] text-ink-subtle">
        <span>
          Model ~{formatMb(modelMb)} / device ~{formatMb(deviceMb)}
        </span>
        {fits === false && (
          <span className="text-danger">may not fit locally</span>
        )}
        {fits === true && <span className="text-positive">fits</span>}
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-surface">
        <div
          className={`h-full rounded-full transition-all ${
            fits === false ? "bg-danger" : "bg-accent"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function LoadProgressBar({
  progress,
}: {
  progress: NonNullable<ProvisionedView["progress"]>;
}) {
  const pct = Math.round(progress.progress * 100);
  return (
    <div className="mt-2">
      <div className="mb-1 flex justify-between text-[11px] text-ink-subtle">
        <span className="truncate">{progress.text || "loading"}</span>
        <span className="tabular-nums">{pct}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-surface">
        <div
          className="h-full rounded-full bg-accent transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function PolicyButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border px-2.5 py-1 text-xs ${
        active
          ? "border-accent bg-accent/10 text-accent-strong"
          : "border-border text-ink-muted hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

function formatMb(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${Math.round(mb)} MB`;
}

const pipelineTone: Record<
  ProvisionedView["status"],
  "neutral" | "accent" | "positive" | "warning" | "danger"
> = {
  planning: "warning",
  warming: "warning",
  ready: "positive",
  queued: "neutral",
  running: "accent",
  done: "positive",
  error: "danger",
};
