"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { scrapeUrl, pagesToCitations } from "@/lib/scrape/client";
import { getCitations, clearCitations, mergeCitations } from "@/lib/scrape/citations";
import { WEB_TOOLS } from "@/lib/tools/web";

export function WebToolsPanel({
  roomId,
  webEnabled,
  onWebEnabledChange,
  agentMode,
  onAgentModeChange,
}: {
  roomId: string;
  webEnabled: boolean;
  onWebEnabledChange: (v: boolean) => void;
  agentMode: boolean;
  onAgentModeChange: (v: boolean) => void;
}) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [citations, setCitations] = useState(() => getCitations(roomId));

  async function quickScrape() {
    const trimmed = url.trim();
    if (!trimmed) return;
    setBusy(true);
    setError(null);
    try {
      const page = await scrapeUrl(trimmed);
      mergeCitations(roomId, pagesToCitations([page]));
      setCitations(getCitations(roomId));
      setUrl("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scrape failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-col gap-2">
        <CardTitle>Web context</CardTitle>
        <div className="flex flex-wrap gap-3 text-xs text-ink-muted">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={webEnabled}
              onChange={(e) => onWebEnabledChange(e.target.checked)}
            />
            Web tools
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={agentMode}
              onChange={(e) => onAgentModeChange(e.target.checked)}
            />
            Agent mode
          </label>
        </div>
      </CardHeader>

      <div className="space-y-3">
        <div className="flex gap-2">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://…"
            className="h-8 min-w-0 flex-1 rounded-lg border border-border bg-canvas px-2 text-xs text-ink outline-none focus:border-accent"
          />
          <Button
            size="sm"
            variant="secondary"
            disabled={busy || !url.trim()}
            onClick={() => void quickScrape()}
          >
            {busy ? "…" : "Scrape"}
          </Button>
        </div>
        {error && <p className="text-xs text-danger">{error}</p>}

        {webEnabled && (
          <ul className="space-y-0.5 text-[11px] text-ink-subtle">
            {WEB_TOOLS.map((t) => (
              <li key={t.name} className="font-mono text-ink-muted">
                {t.name}
              </li>
            ))}
          </ul>
        )}

        {citations.length > 0 && (
          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs text-ink-muted">Sources ({citations.length})</span>
              <button
                type="button"
                className="text-[11px] text-ink-subtle hover:text-danger"
                onClick={() => {
                  clearCitations(roomId);
                  setCitations([]);
                }}
              >
                Clear
              </button>
            </div>
            <ul className="max-h-24 space-y-0.5 overflow-y-auto text-[11px]">
              {citations.map((c) => (
                <li key={c.id} className="truncate">
                  <span className="font-mono text-accent">[{c.id}]</span>{" "}
                  <a
                    href={c.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-ink hover:underline"
                  >
                    {c.title}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Card>
  );
}
