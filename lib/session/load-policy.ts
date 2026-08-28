export type ModelLoadPolicy = "keep-warm" | "evict-idle";

const KEY = "teamthink.loadPolicy.v1";

export function getStoredLoadPolicy(): ModelLoadPolicy {
  if (typeof window === "undefined") return "keep-warm";
  const v = localStorage.getItem(KEY);
  return v === "evict-idle" ? "evict-idle" : "keep-warm";
}

export function setStoredLoadPolicy(policy: ModelLoadPolicy): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, policy);
}

/** Idle evict timeout when policy is evict-idle (15 minutes). */
export const IDLE_EVICT_MS = 15 * 60 * 1000;
