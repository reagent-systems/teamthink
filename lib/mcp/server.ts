/**
 * Expose the TeamThink mesh as an MCP server (ROADMAP #77).
 * JSON-RPC 2.0 over HTTP — tools mirror the local OpenAI gateway surface.
 */

export interface McpServerTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export const MESH_MCP_TOOLS: McpServerTool[] = [
  {
    name: "list_models",
    description: "List models available on the TeamThink mesh gateway",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "chat",
    description: "Run a chat completion against the mesh",
    inputSchema: {
      type: "object",
      properties: {
        model: { type: "string" },
        messages: {
          type: "array",
          items: {
            type: "object",
            properties: {
              role: { type: "string" },
              content: { type: "string" },
            },
          },
        },
      },
      required: ["model", "messages"],
    },
  },
  {
    name: "room_status",
    description: "Get peer count and connection status for a room",
    inputSchema: {
      type: "object",
      properties: { roomId: { type: "string" } },
      required: ["roomId"],
    },
  },
  {
    name: "embed",
    description: "Create embeddings via the mesh gateway",
    inputSchema: {
      type: "object",
      properties: {
        model: { type: "string" },
        input: { type: "string" },
      },
      required: ["model", "input"],
    },
  },
];

interface JsonRpcRequest {
  jsonrpc?: string;
  id?: number | string;
  method?: string;
  params?: Record<string, unknown>;
}

export async function handleMcpRequest(
  body: JsonRpcRequest,
  ctx: {
    listModels: () => string[];
    chat: (model: string, messages: { role: string; content: string }[]) => Promise<string>;
    embed: (model: string, input: string) => Promise<number[]>;
    roomPeers: (roomId: string) => number;
  },
): Promise<unknown> {
  const id = body.id ?? 0;
  const method = body.method ?? "";

  if (method === "initialize") {
    return {
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "teamthink-mesh", version: "0.14.0" },
      },
    };
  }

  if (method === "notifications/initialized") {
    return { jsonrpc: "2.0", id, result: {} };
  }

  if (method === "tools/list") {
    return {
      jsonrpc: "2.0",
      id,
      result: { tools: MESH_MCP_TOOLS },
    };
  }

  if (method === "tools/call") {
    const name = body.params?.name as string;
    const args = (body.params?.arguments ?? {}) as Record<string, unknown>;
    return handleToolCall(id, name, args, ctx);
  }

  return {
    jsonrpc: "2.0",
    id,
    error: { code: -32601, message: `Method not found: ${method}` },
  };
}

async function handleToolCall(
  id: number | string,
  name: string,
  args: Record<string, unknown>,
  ctx: {
    listModels: () => string[];
    chat: (model: string, messages: { role: string; content: string }[]) => Promise<string>;
    embed: (model: string, input: string) => Promise<number[]>;
    roomPeers: (roomId: string) => number;
  },
): Promise<unknown> {
  try {
    let text = "";
    if (name === "list_models") {
      text = JSON.stringify(ctx.listModels(), null, 2);
    } else if (name === "chat") {
      const model = String(args.model ?? "");
      const messages = (args.messages ?? []) as { role: string; content: string }[];
      text = await ctx.chat(model, messages);
    } else if (name === "embed") {
      const vec = await ctx.embed(String(args.model ?? ""), String(args.input ?? ""));
      text = JSON.stringify({ embedding: vec.slice(0, 8), dimensions: vec.length });
    } else if (name === "room_status") {
      const roomId = String(args.roomId ?? "");
      text = JSON.stringify({ roomId, peers: ctx.roomPeers(roomId), connected: true });
    } else {
      return {
        jsonrpc: "2.0",
        id,
        error: { code: -32602, message: `Unknown tool: ${name}` },
      };
    }
    return {
      jsonrpc: "2.0",
      id,
      result: { content: [{ type: "text", text }] },
    };
  } catch (err) {
    return {
      jsonrpc: "2.0",
      id,
      error: { code: -32000, message: err instanceof Error ? err.message : "tool failed" },
    };
  }
}
