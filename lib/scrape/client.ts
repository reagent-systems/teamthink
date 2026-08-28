import { WORKER_HTTP_URL } from "@/lib/config";
import { authHeaders } from "@/lib/auth/types";
import { firecrawlScrape } from "@/lib/scrape/firecrawl";
import { extractStructuredFromHtml } from "@/lib/scrape/extract-json";
import { parseHtml } from "@/lib/scrape/html-to-md";
import { redactPii } from "@/lib/scrape/pii";
import { getScrapeSettings } from "@/lib/scrape/settings";
import type { Citation, ScrapeResult, SearchResult } from "@/lib/scrape/types";

async function workerPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
  if (!WORKER_HTTP_URL) {
    throw new Error("Set NEXT_PUBLIC_SIGNAL_WS_URL to enable web scrape tools");
  }
  const res = await fetch(`${WORKER_HTTP_URL}${path}`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
  void import("@/lib/platform/client").then(({ consumeQuota }) =>
    consumeQuota({ scrapes: 1 }).catch(() => {}),
  );
  return json;
}

function maybeRedact(page: ScrapeResult): ScrapeResult {
  if (!getScrapeSettings().redactPii) return page;
  return { ...page, markdown: redactPii(page.markdown) };
}

/** Scrape a URL → Markdown via Firecrawl or the Worker proxy. */
export async function scrapeUrl(url: string): Promise<ScrapeResult> {
  const settings = getScrapeSettings();
  let page: ScrapeResult;
  if (settings.provider === "firecrawl" && settings.firecrawlApiKey.trim()) {
    page = await firecrawlScrape(url, settings.firecrawlApiKey.trim());
  } else if (WORKER_HTTP_URL) {
    page = await workerPost<ScrapeResult>("/scrape", { url });
  } else {
    page = await scrapeDirect(url);
  }
  return maybeRedact(page);
}

async function scrapeDirect(url: string): Promise<ScrapeResult> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();
  const parsed = parseHtml(html, url);
  return { url, ...parsed };
}

async function fetchHtml(url: string): Promise<string> {
  if (WORKER_HTTP_URL) {
    const page = await workerPost<ScrapeResult>("/scrape", { url });
    return page.markdown;
  }
  const res = await fetch(url);
  return res.text();
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
    return data.pages.map(maybeRedact);
  }
  return [maybeRedact(await scrapeDirect(url))];
}

export async function webSearch(query: string, limit = 5): Promise<SearchResult[]> {
  if (!WORKER_HTTP_URL) throw new Error("Web search requires NEXT_PUBLIC_SIGNAL_WS_URL");
  const data = await workerPost<{ results: SearchResult[] }>("/search", {
    query,
    limit,
    mode: "web",
  });
  return data.results;
}

export async function newsSearch(query: string, limit = 5): Promise<SearchResult[]> {
  if (!WORKER_HTTP_URL) throw new Error("News search requires NEXT_PUBLIC_SIGNAL_WS_URL");
  const data = await workerPost<{ results: SearchResult[] }>("/search", {
    query,
    limit,
    mode: "news",
  });
  return data.results;
}

export async function imageSearch(
  query: string,
  limit = 8,
): Promise<(SearchResult & { imageUrl?: string })[]> {
  if (!WORKER_HTTP_URL) throw new Error("Image search requires NEXT_PUBLIC_SIGNAL_WS_URL");
  const data = await workerPost<{ results: (SearchResult & { imageUrl?: string })[] }>(
    "/search",
    { query, limit, mode: "images" },
  );
  return data.results;
}

export async function parsePdfUrl(url: string): Promise<{ url: string; markdown: string }> {
  if (WORKER_HTTP_URL) {
    const doc = await workerPost<{ url: string; markdown: string }>("/parse-pdf", { url });
    if (getScrapeSettings().redactPii) {
      doc.markdown = redactPii(doc.markdown);
    }
    return doc;
  }
  throw new Error("PDF parse requires the TeamThink Worker proxy");
}

export async function extractJsonFromUrl(
  url: string,
  schemaHint?: string,
): Promise<Record<string, unknown>> {
  if (WORKER_HTTP_URL) {
    return workerPost("/extract-json", { url, schemaHint });
  }
  const html = await fetchHtml(url);
  return extractStructuredFromHtml(html, schemaHint);
}

export async function browserInteract(
  url: string,
  actions: { type: string; ms?: number; selector?: string; text?: string }[],
): Promise<string> {
  const notes: string[] = [];
  let page = await scrapeUrl(url);
  for (const action of actions) {
    switch (action.type) {
      case "wait":
        await sleep(action.ms ?? 1000);
        notes.push(`waited ${action.ms ?? 1000}ms`);
        break;
      case "scroll":
      case "click":
      case "type":
        notes.push(`${action.type} simulated — re-fetching static snapshot`);
        page = await scrapeUrl(url);
        break;
      case "resnapshot":
        page = await scrapeUrl(url);
        break;
      default:
        notes.push(`unknown action ${action.type}`);
    }
  }
  return [
    ...notes.map((n) => `(${n})`),
    formatScrapeForTool(page),
    "Dynamic JS interactions may need a live browser; static fetch used.",
  ].join("\n");
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
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
