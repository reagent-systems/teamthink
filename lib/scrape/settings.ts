const KEY = "teamthink.scrape.settings.v1";

export type ScrapeProvider = "worker" | "firecrawl";

export interface ScrapeSettings {
  firecrawlApiKey: string;
  provider: ScrapeProvider;
  redactPii: boolean;
}

const DEFAULTS: ScrapeSettings = {
  firecrawlApiKey: "",
  provider: "worker",
  redactPii: false,
};

export function getScrapeSettings(): ScrapeSettings {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
  } catch {
    return DEFAULTS;
  }
}

export function saveScrapeSettings(patch: Partial<ScrapeSettings>): ScrapeSettings {
  const next = { ...getScrapeSettings(), ...patch };
  localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}
