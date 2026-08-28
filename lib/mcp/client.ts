import type { ToolDefinition } from "@/lib/tools/types";

export interface McpTool {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

interface JsonRpcResponse<T = unknown> {
  jsonrpc: string;
  id: number | string;
  result?: T;
  error?: { code: number; message: string };
}

let nextId = 1;

async function rpc<T>(
  baseUrl: string,
  method: string,
  params?: Record<string, unknown>,
): Promise<T> {
  const url = baseUrl.replace(/\/+$/, "");
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: nextId++,
      method,
      params: params ?? {},
    }),
  });
  const ct = res.headers.get("content-type") ?? "";
  let payload: JsonRpcResponse<T>;
  if (ct.includes("text/event-stream")) {
    const text = await res.text();
    const dataLine = text
      .split("\n")
      .find((l) => l.startsWith("data:"));
    if (!dataLine) throw new Error("empty MCP SSE response");
    payload = JSON.parse(dataLine.slice(5).trim()) as JsonRpcResponse<T>;
  } else {
    payload = (await res.json()) as JsonRpcResponse<T>;
  }
  if (payload.error) throw new Error(payload.error.message);
  if (payload.result === undefined) throw new Error("MCP response missing result");
  return payload.result;
}

/** Connect and initialize an MCP HTTP server. */
export async function mcpConnect(baseUrl: string): Promise<{ name: string }> {
  const init = await rpc<{
    serverInfo?: { name?: string };
  }>(baseUrl, "initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "teamthink", version: "0.8.0" },
  });
  await rpc(baseUrl, "notifications/initialized", {});
  return { name: init.serverInfo?.name ?? baseUrl };
}

export async function mcpListTools(baseUrl: string): Promise<McpTool[]> {
  const result = await rpc<{ tools?: McpTool[] }>(baseUrl, "tools/list", {});
  return result.tools ?? [];
}

export async function mcpCallTool(
  baseUrl: string,
  name: string,
  args: Record<string, unknown>,
): Promise<string> {
  const result = await rpc<{
    content?: { type: string; text?: string }[];
    isError?: boolean;
  }>(baseUrl, "tools/call", { name, arguments: args });
  if (result.isError) {
    return result.content?.map((c) => c.text ?? "").join("\n") || "tool error";
  }
  return (
    result.content
      ?.filter((c) => c.type === "text")
      .map((c) => c.text ?? "")
      .join("\n") || ""
  );
}

export function mcpToToolDefinition(tool: McpTool): ToolDefinition {
  return {
    name: tool.name,
    description: tool.description ?? "MCP tool",
    parameters: tool.inputSchema ?? { type: "object", properties: {} },
  };
}

export type McpToolRoute = { serverUrl: string; definition: ToolDefinition };

/** Map tool name → MCP server route (names must be unique across servers). */
export function indexMcpTools(
  servers: { url: string; tools: McpTool[] }[],
): Map<string, McpToolRoute> {
  const out = new Map<string, McpToolRoute>();
  for (const s of servers) {
    for (const t of s.tools) {
      out.set(t.name, {
        serverUrl: s.url,
        definition: mcpToToolDefinition(t),
      });
    }
  }
  return out;
}
