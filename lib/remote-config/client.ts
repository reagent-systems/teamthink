import { WORKER_HTTP_URL } from "@/lib/config";
import { authHeaders } from "@/lib/auth/types";
import { DEFAULT_MODEL_ID } from "@/lib/config";

export interface RemoteConfig {
  featureFlags: Record<string, boolean>;
  modelAllowlist: string[] | null;
  defaultSampler: {
    temperature: number;
    topP: number;
    maxTokens: number;
  };
  hybridFallbackEnabled: boolean;
  appCheckRequired: boolean;
}

const CACHE_KEY = "teamthink.remoteConfig.v1";

const DEFAULT_CONFIG: RemoteConfig = {
  featureFlags: {
    webTools: true,
    agentMode: true,
    mcp: true,
    hybridFallback: true,
    orgWorkspaces: true,
  },
  modelAllowlist: null,
  defaultSampler: { temperature: 0.7, topP: 0.95, maxTokens: 512 },
  hybridFallbackEnabled: true,
  appCheckRequired: false,
};

function readCache(): RemoteConfig | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as RemoteConfig) : null;
  } catch {
    return null;
  }
}

function writeCache(cfg: RemoteConfig): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(CACHE_KEY, JSON.stringify(cfg));
}

export async function fetchRemoteConfig(): Promise<RemoteConfig> {
  if (!WORKER_HTTP_URL) return readCache() ?? DEFAULT_CONFIG;
  try {
    const res = await fetch(`${WORKER_HTTP_URL}/config`, {
      headers: authHeaders(),
    });
    const cfg = (await res.json()) as RemoteConfig;
    writeCache(cfg);
    return cfg;
  } catch {
    return readCache() ?? DEFAULT_CONFIG;
  }
}

export function isModelAllowed(modelId: string, cfg: RemoteConfig): boolean {
  if (!cfg.modelAllowlist?.length) return true;
  return cfg.modelAllowlist.includes(modelId);
}

export function getDefaultModel(cfg: RemoteConfig): string {
  if (!cfg.modelAllowlist?.length) return DEFAULT_MODEL_ID;
  return cfg.modelAllowlist[0] ?? DEFAULT_MODEL_ID;
}

export { DEFAULT_CONFIG as DEFAULT_REMOTE_CONFIG };
