import type { ScrapeResult } from "@/lib/scrape/types";

const API = "https://api.firecrawl.dev/v1/scrape";

/** Firecrawl-hosted scrape when user supplies an API key. */
export async function firecrawlScrape(
  url: string,
  apiKey: string,
): Promise<ScrapeResult> {
  const res = await fetch(API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ url, formats: ["markdown", "links"] }),
  });
  const json = (await res.json()) as {
    success?: boolean;
    error?: string;
    data?: {
      markdown?: string;
      metadata?: { title?: string; sourceURL?: string };
      links?: string[];
    };
  };
  if (!res.ok || !json.success) {
    throw new Error(json.error ?? `Firecrawl HTTP ${res.status}`);
  }
  const data = json.data ?? {};
  return {
    url: data.metadata?.sourceURL ?? url,
    title: data.metadata?.title ?? url,
    markdown: data.markdown ?? "",
    links: data.links ?? [],
  };
}
