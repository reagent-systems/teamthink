"use client";

import { Button } from "@/components/ui/Button";
import type { GridNode } from "@/lib/grid/scheduler";
import type { GridSnapshot } from "@/lib/grid/types";

/** Surfaces recoverable errors with retry / unload actions. */
export function RecoveryBanner({
  node,
  snapshot,
}: {
  node: GridNode;
  snapshot: GridSnapshot;
}) {
  const err =
    snapshot.lastError ??
    (snapshot.provisioned?.status === "error"
      ? snapshot.provisioned.error
      : null);
  const failedJob = snapshot.pipelines.find((p) => p.status === "error");

  if (!err && !failedJob) return null;

  const message = err ?? failedJob?.error ?? "Something went wrong";
  const isPeerDrop = /peer|shard|dropped|timed out/i.test(message);

  return (
    <div className="rounded-xl border border-danger/40 bg-danger/5 px-4 py-3 text-sm">
      <p className="font-medium text-ink">{message}</p>
      {isPeerDrop && (
        <p className="mt-1 text-xs text-ink-muted">
          A compute peer may have left mid-shard. Retry after peers reconnect, or
          unload and pick a smaller model.
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {snapshot.provisioned?.status === "error" && (
          <Button size="sm" onClick={() => void node.retryProvision()}>
            Retry load
          </Button>
        )}
        {failedJob && snapshot.provisioned?.status === "ready" && (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => node.stopCurrentJob()}
          >
            Stop job
          </Button>
        )}
        {snapshot.provisioned && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => void node.deprovision()}
          >
            Unload model
          </Button>
        )}
      </div>
    </div>
  );
}
