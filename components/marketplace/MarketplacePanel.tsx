"use client";

import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import {
  listMarketplace,
  getInstalled,
  installPlugin,
  uninstallPlugin,
} from "@/lib/plugins/registry";
import { listAdapters, publishAdapter } from "@/lib/adapters/hub";
import { useState } from "react";

export function MarketplacePanel() {
  const [installed, setInstalled] = useState(() => getInstalled());
  const plugins = listMarketplace();
  const adapters = listAdapters();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Marketplace</CardTitle>
      </CardHeader>
      <div className="space-y-4 text-sm">
        <div>
          <p className="mb-2 font-medium text-ink">Plugins</p>
          <ul className="space-y-2">
            {plugins.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2"
              >
                <div>
                  <p className="font-medium text-ink">{p.name}</p>
                  <p className="text-xs text-ink-muted">{p.description}</p>
                </div>
                {installed.includes(p.id) ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      uninstallPlugin(p.id);
                      setInstalled(getInstalled());
                    }}
                  >
                    Remove
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      installPlugin(p.id);
                      setInstalled(getInstalled());
                    }}
                  >
                    Install
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="mb-2 font-medium text-ink">LoRA adapters</p>
          <ul className="space-y-1 text-xs text-ink-muted">
            {adapters.map((a) => (
              <li key={a.id}>
                {a.name} · {a.baseModel}
              </li>
            ))}
          </ul>
          <Button
            size="sm"
            variant="secondary"
            className="mt-2"
            onClick={() =>
              publishAdapter({
                baseModel: "smollm2-360m",
                name: "My adapter",
                description: "Custom LoRA",
              })
            }
          >
            Publish adapter
          </Button>
        </div>
        <Badge tone="neutral">{installed.length} installed</Badge>
      </div>
    </Card>
  );
}
