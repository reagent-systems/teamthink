"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import {
  indexMcpTools,
  mcpConnect,
  mcpListTools,
  type McpToolRoute,
} from "@/lib/mcp/client";
import {
  addMcpServer,
  listMcpServers,
  removeMcpServer,
} from "@/lib/mcp/store";
import type { ToolDefinition } from "@/lib/tools/types";

export function McpPanel({
  roomId,
  enabled,
  onEnabledChange,
  onToolsChange,
}: {
  roomId: string;
  enabled: boolean;
  onEnabledChange: (v: boolean) => void;
  onToolsChange: (tools: ToolDefinition[], routes: Map<string, McpToolRoute>) => void;
}) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [servers, setServers] = useState(() => listMcpServers(roomId));

  function refresh() {
    setServers(listMcpServers(roomId));
  }

  async function connect() {
    const trimmed = url.trim();
    if (!trimmed) return;
    setBusy(true);
    setError(null);
    try {
      const { name } = await mcpConnect(trimmed);
      await mcpListTools(trimmed);
      addMcpServer(roomId, trimmed, name);
      refresh();
      setUrl("");
      const all = listMcpServers(roomId);
      const indexed = indexMcpTools(
        await Promise.all(
          all.map(async (s) => ({
            url: s.url,
            tools: await mcpListTools(s.url),
          })),
        ),
      );
      onToolsChange(
        [...indexed.values()].map((r) => r.definition),
        indexed,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connect failed");
    } finally {
      setBusy(false);
    }
  }

  async function reloadTools() {
    const all = listMcpServers(roomId);
    if (all.length === 0) {
      onToolsChange([], new Map());
      return;
    }
    try {
      const indexed = indexMcpTools(
        await Promise.all(
          all.map(async (s) => ({
            url: s.url,
            tools: await mcpListTools(s.url),
          })),
        ),
      );
      onToolsChange(
        [...indexed.values()].map((r) => r.definition),
        indexed,
      );
    } catch {
      onToolsChange([], new Map());
    }
  }

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <CardTitle>MCP servers</CardTitle>
        <label className="flex items-center gap-2 text-xs text-ink-muted">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => {
              onEnabledChange(e.target.checked);
              if (e.target.checked) void reloadTools();
            }}
          />
          MCP tools
        </label>
      </CardHeader>

      <div className="space-y-3">
        <div className="flex gap-2">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://host/mcp"
            className="h-8 min-w-0 flex-1 rounded-lg border border-border bg-canvas px-2 text-xs text-ink outline-none focus:border-accent"
          />
          <Button size="sm" variant="secondary" disabled={busy || !url.trim()} onClick={() => void connect()}>
            {busy ? "…" : "Connect"}
          </Button>
        </div>
        {error && <p className="text-xs text-danger">{error}</p>}

        <ul className="max-h-28 space-y-1 overflow-y-auto text-xs">
          {servers.map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-border px-2 py-1"
            >
              <span className="truncate">
                <span className="font-mono text-ink">{s.name}</span>
                <span className="ml-2 text-ink-subtle">{s.url}</span>
              </span>
              <button
                type="button"
                className="shrink-0 text-ink-subtle hover:text-danger"
                onClick={() => {
                  removeMcpServer(s.id);
                  refresh();
                  void reloadTools();
                }}
              >
                Remove
              </button>
            </li>
          ))}
          {servers.length === 0 && (
            <li className="py-2 text-center text-ink-subtle">No MCP servers connected</li>
          )}
        </ul>
      </div>
    </Card>
  );
}
