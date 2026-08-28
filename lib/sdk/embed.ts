/**
 * iframe / embed SDK for docs sites (ROADMAP #83).
 */

export interface EmbedConfig {
  roomId: string;
  origin?: string;
  apiKey?: string;
  height?: number;
}

export function embedUrl(cfg: EmbedConfig): string {
  const origin =
    cfg.origin ??
    (typeof window !== "undefined" ? window.location.origin : "https://teamthink.app");
  const params = new URLSearchParams({ r: cfg.roomId, embed: "1" });
  if (cfg.apiKey) params.set("key", cfg.apiKey);
  return `${origin}/s?${params.toString()}`;
}

export function embedIframeHtml(cfg: EmbedConfig): string {
  const url = embedUrl(cfg);
  const h = cfg.height ?? 480;
  return `<iframe src="${url}" width="100%" height="${h}" style="border:1px solid #ccc;border-radius:12px" title="TeamThink chat"></iframe>`;
}

/** postMessage bridge for parent pages hosting the embed. */
export function listenEmbedMessages(
  onMessage: (data: { type: string; payload?: unknown }) => void,
): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = (e: MessageEvent) => {
    if (e.data?.source !== "teamthink-embed") return;
    onMessage(e.data);
  };
  window.addEventListener("message", handler);
  return () => window.removeEventListener("message", handler);
}

export function postToEmbedParent(type: string, payload?: unknown): void {
  if (typeof window === "undefined" || window.parent === window) return;
  window.parent.postMessage({ source: "teamthink-embed", type, payload }, "*");
}
