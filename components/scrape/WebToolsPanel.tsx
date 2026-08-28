"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { scrapeUrl, pagesToCitations } from "@/lib/scrape/client";
import { getCitations, clearCitations, mergeCitations } from "@/lib/scrape/citations";
import {
  BATCH_EVENT,
  enqueueBatchScrape,
  listBatchJobs,
  type BatchJob,
} from "@/lib/scrape/batch";
import {
  WATCH_EVENT,
  addWatchedUrl,
  checkAllWatched,
  listWatchedUrls,
  removeWatchedUrl,
  type WatchedUrl,
} from "@/lib/scrape/watch";
import {
  getScrapeSettings,
  saveScrapeSettings,
  type ScrapeProvider,
} from "@/lib/scrape/settings";
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
  const [batchText, setBatchText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [citations, setCitations] = useState(() => getCitations(roomId));
  const [batches, setBatches] = useState<BatchJob[]>(() => listBatchJobs(roomId));
  const [watches, setWatches] = useState<WatchedUrl[]>(() => listWatchedUrls(roomId));
  const [settings, setSettings] = useState(getScrapeSettings);

  useEffect(() => {
    function refresh() {
      setBatches(listBatchJobs(roomId));
    }
    window.addEventListener(BATCH_EVENT, refresh);
    return () => window.removeEventListener(BATCH_EVENT, refresh);
  }, [roomId]);

  useEffect(() => {
    function refresh() {
      setWatches(listWatchedUrls(roomId));
    }
    window.addEventListener(WATCH_EVENT, refresh);
    return () => window.removeEventListener(WATCH_EVENT, refresh);
  }, [roomId]);

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

  function startBatch(ingest: boolean) {
    const urls = batchText
      .split(/\n/)
      .map((l) => l.trim())
      .filter((l) => l.startsWith("http"));
    if (urls.length === 0) return;
    enqueueBatchScrape(roomId, urls, { ingestToRag: ingest });
    setBatchText("");
    setBatches(listBatchJobs(roomId));
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
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={settings.redactPii}
              onChange={(e) =>
                setSettings(saveScrapeSettings({ redactPii: e.target.checked }))
              }
            />
            Redact PII
          </label>
        </div>
      </CardHeader>

      <div className="space-y-3">
        <div className="flex flex-wrap gap-2 text-xs">
          <select
            value={settings.provider}
            onChange={(e) =>
              setSettings(
                saveScrapeSettings({ provider: e.target.value as ScrapeProvider }),
              )
            }
            className="h-8 rounded-lg border border-border bg-canvas px-2 text-ink outline-none focus:border-accent"
          >
            <option value="worker">Worker proxy</option>
            <option value="firecrawl">Firecrawl API</option>
          </select>
          {settings.provider === "firecrawl" && (
            <input
              type="password"
              value={settings.firecrawlApiKey}
              onChange={(e) =>
                setSettings(saveScrapeSettings({ firecrawlApiKey: e.target.value }))
              }
              placeholder="Firecrawl API key"
              className="h-8 min-w-0 flex-1 rounded-lg border border-border bg-canvas px-2 text-ink outline-none focus:border-accent"
            />
          )}
        </div>

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

        <textarea
          value={batchText}
          onChange={(e) => setBatchText(e.target.value)}
          rows={2}
          placeholder={"Batch URLs (one per line)…"}
          className="w-full resize-y rounded-lg border border-border bg-canvas px-2 py-1 text-xs text-ink outline-none focus:border-accent"
        />
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => startBatch(false)}>
            Batch scrape
          </Button>
          <Button size="sm" variant="secondary" onClick={() => startBatch(true)}>
            Batch + RAG
          </Button>
        </div>

        {batches[0] && (
          <p className="text-[11px] text-ink-muted">
            Latest batch: {batches[0].status} — {batches[0].completed}/{batches[0].urls.length}{" "}
            ok, {batches[0].failed} failed
          </p>
        )}

        <div className="flex gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              const watchUrl = window.prompt("Watch URL for changes", url || "https://");
              if (watchUrl?.trim()) {
                addWatchedUrl(roomId, watchUrl.trim());
                setWatches(listWatchedUrls(roomId));
              }
            }}
          >
            Watch URL
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => void checkAllWatched(roomId).then(setWatches)}
          >
            Check watches
          </Button>
        </div>
        {watches.length > 0 && (
          <ul className="max-h-20 space-y-0.5 overflow-y-auto text-[11px]">
            {watches.map((w) => (
              <li key={w.id} className="flex items-center justify-between gap-2">
                <span className={w.changed ? "text-accent" : "text-ink-muted"}>
                  {w.changed ? "Changed: " : ""}
                  {w.lastTitle || w.url}
                </span>
                <button
                  type="button"
                  className="shrink-0 text-ink-subtle hover:text-danger"
                  onClick={() => {
                    removeWatchedUrl(w.id);
                    setWatches(listWatchedUrls(roomId));
                  }}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}

        {error && <p className="text-xs text-danger">{error}</p>}

        {webEnabled && (
          <ul className="max-h-28 space-y-0.5 overflow-y-auto text-[11px] text-ink-subtle">
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
