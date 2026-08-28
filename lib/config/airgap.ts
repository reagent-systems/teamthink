/** Air-gapped mode — offline model mirror (ROADMAP #90). */

const AIRGAP_KEY = "teamthink.airgap.v1";

export interface AirgapSettings {
  enabled: boolean;
  mirrorBaseUrl: string;
  blockHfCdn: boolean;
}

export function getAirgapSettings(): AirgapSettings {
  if (typeof localStorage === "undefined") {
    return { enabled: false, mirrorBaseUrl: "", blockHfCdn: false };
  }
  try {
    const raw = localStorage.getItem(AIRGAP_KEY);
    return raw
      ? (JSON.parse(raw) as AirgapSettings)
      : { enabled: false, mirrorBaseUrl: "", blockHfCdn: false };
  } catch {
    return { enabled: false, mirrorBaseUrl: "", blockHfCdn: false };
  }
}

export function setAirgapSettings(s: Partial<AirgapSettings>): void {
  const merged = { ...getAirgapSettings(), ...s };
  localStorage.setItem(AIRGAP_KEY, JSON.stringify(merged));
}

export function resolveModelUrl(hfUrl: string): string {
  const cfg = getAirgapSettings();
  if (!cfg.enabled || !cfg.mirrorBaseUrl.trim()) return hfUrl;
  if (cfg.blockHfCdn && hfUrl.includes("huggingface.co")) {
    return `${cfg.mirrorBaseUrl.replace(/\/+$/, "")}/${hfUrl.split("huggingface.co/")[1] ?? ""}`;
  }
  return hfUrl;
}
