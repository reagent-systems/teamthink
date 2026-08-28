"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import {
  deleteDocument,
  ingestText,
  listDocuments,
  type RagSearchMode,
} from "@/lib/rag/store";

export function DocumentPanel({
  roomId,
  ragEnabled,
  onRagEnabledChange,
  ragSearchMode,
  onRagSearchModeChange,
}: {
  roomId: string;
  ragEnabled: boolean;
  onRagEnabledChange: (v: boolean) => void;
  ragSearchMode: RagSearchMode;
  onRagSearchModeChange: (v: RagSearchMode) => void;
}) {
  const [docs, setDocs] = useState(() => listDocuments(roomId));
  const [paste, setPaste] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function refresh() {
    setDocs(listDocuments(roomId));
  }

  async function ingest(name: string, text: string, kind: "txt" | "md" | "paste") {
    setBusy(true);
    setError(null);
    try {
      await ingestText(roomId, name, text, kind);
      refresh();
      setPaste("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Index failed");
    } finally {
      setBusy(false);
    }
  }

  async function onFile(file: File) {
    const text = await file.text();
    const kind = file.name.endsWith(".md") ? "md" : "txt";
    await ingest(file.name, text, kind);
  }

  return (
    <Card>
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle>Documents</CardTitle>
        <div className="flex flex-wrap items-center gap-3 text-xs text-ink-muted">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={ragEnabled}
              onChange={(e) => onRagEnabledChange(e.target.checked)}
            />
            RAG on send
          </label>
          {ragEnabled && (
            <select
              value={ragSearchMode}
              onChange={(e) =>
                onRagSearchModeChange(e.target.value as RagSearchMode)
              }
              className="h-7 rounded-lg border border-border bg-canvas px-2 text-xs text-ink outline-none focus:border-accent"
              aria-label="RAG search mode"
            >
              <option value="hybrid">Hybrid (BM25 + vector)</option>
              <option value="vector">Vector only</option>
              <option value="bm25">BM25 only</option>
            </select>
          )}
        </div>
      </CardHeader>

      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <label className="cursor-pointer">
            <input
              type="file"
              accept=".txt,.md,text/plain,text/markdown"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onFile(f);
                e.target.value = "";
              }}
            />
            <span className="inline-flex h-8 items-center rounded-lg border border-border bg-canvas px-3 text-xs text-ink hover:border-accent">
              Upload .txt / .md
            </span>
          </label>
        </div>

        <textarea
          value={paste}
          onChange={(e) => setPaste(e.target.value)}
          rows={3}
          placeholder="Paste text to index…"
          className="w-full resize-y rounded-xl border border-border bg-canvas px-3 py-2 text-sm text-ink outline-none focus:border-accent"
        />
        <Button
          size="sm"
          variant="secondary"
          disabled={!paste.trim() || busy}
          onClick={() => void ingest("Pasted note", paste, "paste")}
        >
          {busy ? "Indexing…" : "Index paste"}
        </Button>

        {error && <p className="text-xs text-danger">{error}</p>}

        <ul className="max-h-36 space-y-1 overflow-y-auto text-xs">
          {docs.map((d) => (
            <li
              key={d.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-border px-2 py-1"
            >
              <span className="truncate text-ink">{d.name}</span>
              <button
                type="button"
                className="shrink-0 text-ink-subtle hover:text-danger"
                onClick={() => {
                  deleteDocument(d.id);
                  refresh();
                }}
              >
                Remove
              </button>
            </li>
          ))}
          {docs.length === 0 && (
            <li className="py-2 text-center text-ink-subtle">
              No documents indexed yet
            </li>
          )}
        </ul>
      </div>
    </Card>
  );
}
