/**
 * Plugin marketplace — community engines, tools, themes (ROADMAP #86).
 */

export type PluginKind = "engine" | "tool" | "rag" | "theme";

export interface PluginManifest {
  id: string;
  name: string;
  kind: PluginKind;
  version: string;
  description: string;
  author: string;
  entry?: string;
}

const BUILTIN_PLUGINS: PluginManifest[] = [
  {
    id: "theme-midnight",
    name: "Midnight theme",
    kind: "theme",
    version: "1.0.0",
    description: "Dark accent palette for session UI",
    author: "TeamThink",
  },
  {
    id: "tool-calculator",
    name: "Calculator tool",
    kind: "tool",
    version: "1.0.0",
    description: "Safe eval for numeric expressions",
    author: "Community",
    entry: "calculator",
  },
  {
    id: "rag-wikipedia",
    name: "Wikipedia RAG",
    kind: "rag",
    version: "0.1.0",
    description: "Fetch Wikipedia summaries into context",
    author: "Community",
  },
];

const INSTALLED_KEY = "teamthink.plugins.v1";

export function listMarketplace(): PluginManifest[] {
  return BUILTIN_PLUGINS;
}

export function getInstalled(): string[] {
  if (typeof localStorage === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(INSTALLED_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}

export function installPlugin(id: string): void {
  const cur = getInstalled();
  if (!cur.includes(id)) {
    cur.push(id);
    localStorage.setItem(INSTALLED_KEY, JSON.stringify(cur));
  }
}

export function uninstallPlugin(id: string): void {
  localStorage.setItem(
    INSTALLED_KEY,
    JSON.stringify(getInstalled().filter((x) => x !== id)),
  );
}
