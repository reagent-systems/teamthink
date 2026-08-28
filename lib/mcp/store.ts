const KEY = "teamthink.mcp.servers.v1";

export interface McpServerRecord {
  id: string;
  roomId: string;
  url: string;
  name: string;
  connectedAt: number;
}

function read(): McpServerRecord[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as McpServerRecord[];
  } catch {
    return [];
  }
}

function write(servers: McpServerRecord[]): void {
  localStorage.setItem(KEY, JSON.stringify(servers));
}

export function listMcpServers(roomId: string): McpServerRecord[] {
  return read().filter((s) => s.roomId === roomId);
}

export function addMcpServer(
  roomId: string,
  url: string,
  name: string,
): McpServerRecord {
  const rec: McpServerRecord = {
    id: `mcp_${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`,
    roomId,
    url: url.trim(),
    name,
    connectedAt: Date.now(),
  };
  write([rec, ...read()]);
  return rec;
}

export function removeMcpServer(id: string): void {
  write(read().filter((s) => s.id !== id));
}
