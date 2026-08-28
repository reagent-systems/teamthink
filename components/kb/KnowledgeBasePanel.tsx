"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import {
  createWorkspace,
  deleteWorkspace,
  ingestUrlToWorkspace,
  listWorkspaces,
  workspaceDocuments,
} from "@/lib/kb/workspaces";

export function KnowledgeBasePanel({ roomId }: { roomId: string }) {
  const [workspaces, setWorkspaces] = useState(() => listWorkspaces(roomId));
  const [selected, setSelected] = useState<string | null>(
    () => listWorkspaces(roomId)[0]?.id ?? null,
  );
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function refresh() {
    const ws = listWorkspaces(roomId);
    setWorkspaces(ws);
    if (selected && !ws.find((w) => w.id === selected)) {
      setSelected(ws[0]?.id ?? null);
    }
  }

  async function addUrl() {
    if (!selected || !url.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await ingestUrlToWorkspace(selected, url.trim());
      setUrl("");
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ingest failed");
    } finally {
      setBusy(false);
    }
  }

  const active = workspaces.find((w) => w.id === selected);
  const docs = active ? workspaceDocuments(active.id) : [];

  return (
    <Card>
      <CardHeader className="flex flex-col gap-2">
        <CardTitle>Knowledge workspaces</CardTitle>
        <div className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="New workspace name"
            className="h-8 min-w-0 flex-1 rounded-lg border border-border bg-canvas px-2 text-xs text-ink outline-none focus:border-accent"
          />
          <Button
            size="sm"
            variant="secondary"
            disabled={!name.trim()}
            onClick={() => {
              const ws = createWorkspace(roomId, name);
              setName("");
              refresh();
              setSelected(ws.id);
            }}
          >
            Add
          </Button>
        </div>
      </CardHeader>

      <div className="space-y-3">
        <select
          value={selected ?? ""}
          onChange={(e) => setSelected(e.target.value || null)}
          className="h-8 w-full rounded-lg border border-border bg-canvas px-2 text-xs text-ink outline-none focus:border-accent"
        >
          {workspaces.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name} ({w.docIds.length} docs)
            </option>
          ))}
        </select>

        {active && (
          <>
            <div className="flex gap-2">
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Scrape URL into workspace…"
                className="h-8 min-w-0 flex-1 rounded-lg border border-border bg-canvas px-2 text-xs text-ink outline-none focus:border-accent"
              />
              <Button
                size="sm"
                variant="secondary"
                disabled={busy || !url.trim()}
                onClick={() => void addUrl()}
              >
                {busy ? "…" : "Add URL"}
              </Button>
            </div>
            {error && <p className="text-xs text-danger">{error}</p>}
            <ul className="max-h-24 space-y-0.5 overflow-y-auto text-[11px]">
              {docs.map((d) => (
                <li key={d.id} className="truncate text-ink-muted">
                  {d.name}
                </li>
              ))}
              {docs.length === 0 && (
                <li className="text-ink-subtle">No documents yet</li>
              )}
            </ul>
            <button
              type="button"
              className="text-[11px] text-ink-subtle hover:text-danger"
              onClick={() => {
                if (!active) return;
                deleteWorkspace(active.id);
                refresh();
              }}
            >
              Delete workspace
            </button>
          </>
        )}
        {workspaces.length === 0 && (
          <p className="text-xs text-ink-subtle">Create a workspace to collect scraped pages.</p>
        )}
      </div>
    </Card>
  );
}
