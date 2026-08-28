"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  getDeviceLabel,
  setDeviceLabel,
  getPreferredPeer,
  setPreferredPeer,
} from "@/lib/grid/device-routing";
import type { PeerPresence } from "@/lib/grid/types";

export function DeviceRoutingPanel({
  roomId,
  peers,
}: {
  roomId: string;
  peers: PeerPresence[];
}) {
  const [label, setLabel] = useState(() => getDeviceLabel());
  const [preferred, setPreferred] = useState(() => getPreferredPeer(roomId));

  function saveLabel() {
    setDeviceLabel(label);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Device routing</CardTitle>
      </CardHeader>
      <div className="space-y-3 text-sm">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={saveLabel}
          placeholder="This device name"
          className="h-9 w-full rounded-lg border border-border bg-canvas px-2"
        />
        <p className="text-xs text-ink-muted">Pin jobs to a preferred peer:</p>
        <select
          value={preferred ?? ""}
          onChange={(e) => {
            const v = e.target.value || null;
            setPreferred(v);
            setPreferredPeer(roomId, v);
          }}
          className="h-9 w-full rounded-lg border border-border bg-canvas px-2"
        >
          <option value="">Auto (latency-aware)</option>
          {peers.map((p) => (
            <option key={p.peerId} value={p.peerId}>
              {p.displayName || p.deviceLabel || p.peerId.slice(0, 8)}
              {p.rttMs != null ? ` · ${Math.round(p.rttMs)}ms` : ""}
            </option>
          ))}
        </select>
        <Button size="sm" variant="secondary" onClick={saveLabel}>
          Save label
        </Button>
      </div>
    </Card>
  );
}
