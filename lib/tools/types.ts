export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface ToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  name: string;
  output: string;
}

export interface ToolContext {
  roomId: string;
  ragSearch: (query: string) => Promise<string>;
  mcpRoutes?: Map<string, { serverUrl: string; definition: ToolDefinition }>;
}
