/** Speculative decoding hook — draft on fast peer, verify on warm model (ROADMAP #65). */

export interface SpeculativeConfig {
  enabled: boolean;
  draftTokens: number;
}

export function defaultSpeculative(): SpeculativeConfig {
  return { enabled: false, draftTokens: 4 };
}

/** Merge draft tokens into verify pass when enabled. */
export function applySpeculativeDraft(
  base: string,
  draft: string,
  cfg: SpeculativeConfig,
): string {
  if (!cfg.enabled || !draft) return base;
  return base + draft.slice(0, cfg.draftTokens);
}
