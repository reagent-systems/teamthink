/** MCP JSON-RPC handler for Worker-hosted mesh export. */

const TOOLS = [
  { name: "list_models", description: "List gateway models", inputSchema: { type: "object", properties: {} } },
  { name: "room_status", description: "Room peer count", inputSchema: { type: "object", properties: { roomId: { type: "string" } } } },
];

export function handleWorkerMcp(body: {
  id?: number | string;
  method?: string;
  params?: Record<string, unknown>;
}): Response {
  const id = body.id ?? 0;
  const method = body.method ?? "";

  if (method === "initialize") {
    return Response.json({
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "teamthink-mesh-worker", version: "0.14.0" },
      },
    });
  }

  if (method === "tools/list") {
    return Response.json({ jsonrpc: "2.0", id, result: { tools: TOOLS } });
  }

  if (method === "tools/call") {
    const name = body.params?.name as string;
    const args = (body.params?.arguments ?? {}) as Record<string, unknown>;
    let text = "";
    if (name === "list_models") {
      text = JSON.stringify(["smollm2-360m", "llama-3.2-1b", "minilm-l6"]);
    } else if (name === "room_status") {
      text = JSON.stringify({ roomId: args.roomId, peers: 0, note: "connect via desktop gateway for live status" });
    } else {
      return Response.json({
        jsonrpc: "2.0",
        id,
        error: { code: -32602, message: `Unknown tool: ${name}` },
      });
    }
    return Response.json({
      jsonrpc: "2.0",
      id,
      result: { content: [{ type: "text", text }] },
    });
  }

  return Response.json({
    jsonrpc: "2.0",
    id,
    error: { code: -32601, message: `Method not found: ${method}` },
  });
}
