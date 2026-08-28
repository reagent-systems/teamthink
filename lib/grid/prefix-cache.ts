/** Prefix / KV-cache sharing for repeated system prompts (ROADMAP #67). */

const prefixCache = new Map<string, string>();

export function cachePrefix(key: string, prefix: string): void {
  prefixCache.set(key, prefix);
}

export function getCachedPrefix(key: string): string | undefined {
  return prefixCache.get(key);
}

export function prefixKey(modelId: string, systemPrompt: string): string {
  return `${modelId}:${systemPrompt.slice(0, 256)}`;
}
