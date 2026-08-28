"use client";

import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { BUILTIN_TOOLS } from "@/lib/tools/builtin";

export function ToolsPanel({
  enabled,
  onEnabledChange,
}: {
  enabled: boolean;
  onEnabledChange: (v: boolean) => void;
}) {
  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <CardTitle>Tools</CardTitle>
        <label className="flex items-center gap-2 text-xs text-ink-muted">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => onEnabledChange(e.target.checked)}
          />
          Agent tools
        </label>
      </CardHeader>
      {enabled && (
        <ul className="space-y-1 text-xs text-ink-muted">
          {BUILTIN_TOOLS.map((t) => (
            <li key={t.name} className="rounded-lg border border-border px-2 py-1">
              <span className="font-mono text-ink">{t.name}</span>
              <span className="ml-2">{t.description}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
