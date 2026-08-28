"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { SignInPanel } from "@/components/auth/SignInPanel";
import {
  fetchRemoteConfig,
  type RemoteConfig,
  DEFAULT_REMOTE_CONFIG,
} from "@/lib/remote-config/client";
import { listAuditLog } from "@/lib/platform/client";
import { useAuth } from "@/hooks/useAuth";
import { WORKER_HTTP_URL } from "@/lib/config";

export default function AdminPage() {
  const { user } = useAuth();
  const [config, setConfig] = useState<RemoteConfig>(DEFAULT_REMOTE_CONFIG);
  const [audit, setAudit] = useState<
    { id: string; at: number; action: string; target: string; actorId: string }[]
  >([]);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void fetchRemoteConfig().then(setConfig);
    if (user) void listAuditLog().then(setAudit).catch(() => {});
  }, [user]);

  async function saveConfig() {
    if (!WORKER_HTTP_URL) return;
    const { authHeaders } = await import("@/lib/auth/types");
    await fetch(`${WORKER_HTTP_URL}/config`, {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify(config),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-6 py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link href="/" className="text-sm text-ink-muted hover:text-accent">
            ← Home
          </Link>
          <h1 className="font-display text-2xl text-ink">Admin console</h1>
        </div>
        <Badge tone={WORKER_HTTP_URL ? "positive" : "neutral"}>
          {WORKER_HTTP_URL ? "Worker connected" : "Offline mode"}
        </Badge>
      </div>

      <SignInPanel />

      <Card>
        <CardHeader>
          <CardTitle>Remote Config</CardTitle>
        </CardHeader>
        <div className="space-y-3 text-sm">
          {Object.entries(config.featureFlags).map(([key, val]) => (
            <label key={key} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={val}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    featureFlags: { ...config.featureFlags, [key]: e.target.checked },
                  })
                }
              />
              <span className="font-mono text-xs">{key}</span>
            </label>
          ))}
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={config.hybridFallbackEnabled}
              onChange={(e) =>
                setConfig({ ...config, hybridFallbackEnabled: e.target.checked })
              }
            />
            <span>Hybrid fallback enabled</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={config.appCheckRequired}
              onChange={(e) =>
                setConfig({ ...config, appCheckRequired: e.target.checked })
              }
            />
            <span>App Check required</span>
          </label>
          <Button size="sm" onClick={() => void saveConfig()} disabled={!user}>
            {saved ? "Saved" : "Save config"}
          </Button>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Audit log</CardTitle>
        </CardHeader>
        <ul className="max-h-64 space-y-1 overflow-y-auto font-mono text-xs text-ink-muted">
          {audit.length === 0 && <li>No entries yet</li>}
          {audit.map((e) => (
            <li key={e.id}>
              {new Date(e.at).toISOString()} · {e.action} · {e.target}
            </li>
          ))}
        </ul>
      </Card>
    </main>
  );
}
