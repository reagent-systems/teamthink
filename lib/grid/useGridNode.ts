"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { GridNode } from "@/lib/grid/scheduler";
import type { GridSnapshot } from "@/lib/grid/types";

/**
 * Creates and owns a GridNode for the lifetime of a session component, exposing
 * its snapshot via useSyncExternalStore for tear-free React updates.
 */
export function useGridNode(roomId: string) {
  // Lazy state init creates the node exactly once; safe to read during render.
  const [node] = useState(() => new GridNode(roomId));
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void node.start().then(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
      node.stop();
    };
  }, [node]);

  const snapshot = useSyncExternalStore<GridSnapshot>(
    (cb) => node.subscribe(cb),
    () => node.getSnapshot(),
    () => node.getSnapshot(),
  );

  return { node, snapshot, ready };
}
