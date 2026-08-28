"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  getHybridSettings,
  setHybridSettings,
  type HybridSettings,
} from "@/lib/platform/hybrid";

export function HybridFallbackPanel({
  meshCold,
}: {
  meshCold: boolean;
}) {
  const [settings, setSettings] = useState<HybridSettings>(() => getHybridSettings());

  function update(partial: Partial<HybridSettings>) {
    const next = { ...settings, ...partial };
    setSettings(next);
    setHybridSettings(next);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Hybrid cloud fallback</CardTitle>
      </CardHeader>
      <div className="space-y-3 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={settings.enabled}
            onChange={(e) => update({ enabled: e.target.checked })}
          />
          <span>Use cloud when mesh is cold</span>
        </label>
        {meshCold && settings.enabled && (
          <p className="text-xs text-accent-strong">Mesh cold — fallback available</p>
        )}
        <select
          value={settings.provider}
          onChange={(e) =>
            update({ provider: e.target.value as HybridSettings["provider"] })
          }
          className="h-9 w-full rounded-lg border border-border bg-canvas px-2"
        >
          <option value="openai">OpenAI</option>
          <option value="anthropic">Anthropic</option>
          <option value="custom">Custom base URL</option>
        </select>
        <input
          type="url"
          value={settings.baseUrl}
          onChange={(e) => update({ baseUrl: e.target.value })}
          placeholder="API base URL"
          className="h-9 w-full rounded-lg border border-border bg-canvas px-2 font-mono text-xs"
        />
        <input
          type="password"
          value={settings.apiKey}
          onChange={(e) => update({ apiKey: e.target.value })}
          placeholder="API key"
          className="h-9 w-full rounded-lg border border-border bg-canvas px-2 font-mono text-xs"
        />
        <input
          type="text"
          value={settings.model}
          onChange={(e) => update({ model: e.target.value })}
          placeholder="Model id"
          className="h-9 w-full rounded-lg border border-border bg-canvas px-2 font-mono text-xs"
        />
        <Button size="sm" variant="secondary" onClick={() => setHybridSettings(settings)}>
          Save
        </Button>
      </div>
    </Card>
  );
}
