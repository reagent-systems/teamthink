import { WORKER_HTTP_URL } from "@/lib/config";
import type { Citation, ScrapeResult, SearchResult } from "@/lib/scrape/types";
import { parseHtml } from "@/lib/scrape/html-to-md";

async function workerPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
  if (!WORKER_HTTP_URL) {
    throw new Error("Set NEXT_PUBLIC_SIGNAL_WS_URL to enable web scrape tools");
  }
  const res = await fetch(`${WORKER_HTTP_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
  return json;
}

/** Scrape a URL → Markdown via the signaling Worker (CORS-safe). */
export async function scrapeUrl(url: string): Promise<ScrapeResult> {
  if (WORKER_HTTP_URL) {
    return workerPost<ScrapeResult>("/scrape", { url });
  }
  return scrapeDirect(url);
}

async function scrapeDirect(url: string): Promise<ScrapeResult> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();
  const parsed = parseHtml(html, url);
  return { url, ...parsed };
}

export async function discoverSiteMap(url: string): Promise<string[]> {
  if (WORKER_HTTP_URL) {
    const data = await workerPost<{ links: string[] }>("/sitemap", { url });
    return data.links;
  }
  const page = await scrapeDirect(url);
  return page.links;
}

export async function crawlSite(
  url: string,
  maxDepth = 1,
  maxPages = 10,
): Promise<ScrapeResult[]> {
  if (WORKER_HTTP_URL) {
    const data = await workerPost<{ pages: ScrapeResult[] }>("/crawl", {
      url,
      maxDepth,
      maxPages,
    });
    return data.pages;
  }
  const root = await scrapeDirect(url);
  return [root];
}

export async function webSearch(query: string, limit = 5): Promise<SearchResult[]> {
  if (!WORKER_HTTP_URL) {
    throw new Error("Web search requires NEXT_PUBLIC_SIGNAL_WS_URL");
  }
  const data = await workerPost<{ results: SearchResult[] }>("/search", {
    query,
    limit,
  });
  return data.results;
}

export async function parsePdfUrl(url: string): Promise<{ url: string; markdown: string }> {
  if (WORKER_HTTP_URL) {
    return workerPost("/parse-pdf", { url });
  }
  throw new Error("PDF parse requires the TeamThink Worker proxy");
}

export function formatScrapeForTool(page: ScrapeResult): string {
  return [
    `Title: ${page.title}`,
    `URL: ${page.url}`,
    `Links: ${page.links.slice(0, 20).join(", ")}`,
    "",
    page.markdown.slice(0, 12_000),
  ].join("\n");
}

export function pagesToCitations(pages: ScrapeResult[], startId = 1): Citation[] {
  return pages.map((p, i) => ({
    id: startId + i,
    url: p.url,
    title: p.title || p.url,
  }));
}
