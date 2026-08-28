import type { ToolCall, ToolContext, ToolDefinition, ToolResult } from "@/lib/tools/types";
import { mcpCallTool } from "@/lib/mcp/client";

export const BUILTIN_TOOLS: ToolDefinition[] = [
  {
    name: "rag_search",
    description: "Search indexed room documents for relevant excerpts.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" },
      },
      required: ["query"],
    },
  },
  {
    name: "calculator",
    description: "Evaluate a basic arithmetic expression (numbers and + - * / % only).",
    parameters: {
      type: "object",
      properties: {
        expression: { type: "string" },
      },
      required: ["expression"],
    },
  },
  {
    name: "current_time",
    description: "Return the current UTC ISO timestamp.",
    parameters: { type: "object", properties: {} },
  },
];

export function toolsSystemPrompt(tools: ToolDefinition[]): string {
  return [
    "You may call tools when needed. To call a tool, respond with ONLY a JSON object:",
    '{"tool_calls":[{"name":"<tool>","arguments":{...}}]}',
    "After receiving tool results you will be asked to answer the user.",
    "Available tools:",
    ...tools.map(
      (t) => `- ${t.name}: ${t.description}\n  parameters: ${JSON.stringify(t.parameters)}`,
    ),
  ].join("\n");
}

export function parseToolCalls(text: string): ToolCall[] | null {
  const trimmed = text.trim();
  try {
    const j = JSON.parse(trimmed) as { tool_calls?: ToolCall[] };
    if (Array.isArray(j.tool_calls) && j.tool_calls.length > 0) return j.tool_calls;
  } catch {
    // fall through
  }
  const match = trimmed.match(/\{[\s\S]*"tool_calls"[\s\S]*\}/);
  if (!match) return null;
  try {
    const j = JSON.parse(match[0]) as { tool_calls?: ToolCall[] };
    return Array.isArray(j.tool_calls) ? j.tool_calls : null;
  } catch {
    return null;
  }
}

export async function runTool(
  call: ToolCall,
  ctx: ToolContext,
): Promise<ToolResult> {
  const mcp = ctx.mcpRoutes?.get(call.name);
  if (mcp) {
    const output = await mcpCallTool(mcp.serverUrl, call.name, call.arguments);
    return { name: call.name, output: output || "(empty)" };
  }
  switch (call.name) {
    case "rag_search": {
      const query = String(call.arguments.query ?? "");
      const output = await ctx.ragSearch(query);
      return { name: call.name, output: output || "No matches." };
    }
    case "calculator": {
      const expr = String(call.arguments.expression ?? "");
      const safe = expr.replace(/[^\d+\-*/().%\s]/g, "");
      if (!safe.trim()) return { name: call.name, output: "Invalid expression" };
      try {
        const val = Function(`"use strict"; return (${safe})`)() as number;
        return { name: call.name, output: String(val) };
      } catch {
        return { name: call.name, output: "Evaluation failed" };
      }
    }
    case "current_time":
      return { name: call.name, output: new Date().toISOString() };
    default:
      return { name: call.name, output: `Unknown tool: ${call.name}` };
  }
}
