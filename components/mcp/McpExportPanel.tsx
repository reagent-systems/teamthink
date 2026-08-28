"use client";

import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { MESH_MCP_TOOLS } from "@/lib/mcp/server";
import { WORKER_HTTP_URL } from "@/lib/config";

export function McpExportPanel({ roomId }: { roomId: string }) {
  const mcpUrl = WORKER_HTTP_URL ? `${WORKER_HTTP_URL}/mcp` : "http://127.0.0.1:11434/mcp";

  return (
    <Card>
      <CardHeader>
        <CardTitle>MCP server export</CardTitle>
      </CardHeader>
      <div className="space-y-3 text-sm">
        <p className="text-ink-muted">
          Point Cursor, Claude Desktop, or other MCP clients at:
        </p>
        <code className="block break-all rounded-lg bg-canvas p-2 font-mono text-xs">
          {mcpUrl}
        </code>
        <p className="text-xs text-ink-muted">Room context: {roomId}</p>
        <ul className="space-y-1 text-xs text-ink-muted">
          {MESH_MCP_TOOLS.map((t) => (
            <li key={t.name}>
              <span className="font-mono text-ink">{t.name}</span> — {t.description}
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}
