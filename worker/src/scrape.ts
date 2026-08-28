import { parseHtml, sameHost } from "./html-to-md";

export interface ScrapeResponse {
  url: string;
  title: string;
  markdown: string;
  links: string[];
}

export interface SearchHit {
  title: string;
  url: string;
  snippet: string;
}

const MAX_BYTES = 2_000_000;
const FETCH_TIMEOUT_MS = 20_000;

export async function fetchAndParse(url: string): Promise<ScrapeResponse> {
  const target = normalizeUrl(url);
  const res = await fetchWithTimeout(target);
  const ct = res.headers.get("content-type") ?? "";
  if (ct.includes("application/pdf")) {
    throw new Error("PDF URL — use parse_pdf tool");
  }
  const html = await readLimited(res);
  const parsed = parseHtml(html, target);
  return { url: target, ...parsed };
}

export async function searchWeb(query: string, limit = 5): Promise<SearchHit[]> {
  const q = encodeURIComponent(query.trim());
  const res = await fetchWithTimeout(
    `https://html.duckduckgo.com/html/?q=${q}`,
    { headers: { "User-Agent": "TeamThink/0.9" } },
  );
  const html = await res.text();
  const hits: SearchHit[] = [];
  const re =
    /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?class="result__snippet"[^>]*>([\s\S]*?)<\/(?:a|td|div)>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) && hits.length < limit) {
    let url = m[1]!;
    const title = strip(m[2]!);
    const snippet = strip(m[3]!);
    if (url.includes("uddg=")) {
      const u = new URL(url, "https://duckduckgo.com");
      url = u.searchParams.get("uddg") ?? url;
    }
    if (title && url.startsWith("http")) hits.push({ title, url, snippet });
  }
  return hits;
}

export async function crawlDomain(
  startUrl: string,
  maxDepth: number,
  maxPages: number,
): Promise<ScrapeResponse[]> {
  const root = normalizeUrl(startUrl);
  const seen = new Set<string>();
  const queue: { url: string; depth: number }[] = [{ url: root, depth: 0 }];
  const out: ScrapeResponse[] = [];

  while (queue.length > 0 && out.length < maxPages) {
    const { url, depth } = queue.shift()!;
    if (seen.has(url)) continue;
    seen.add(url);
    try {
      const page = await fetchAndParse(url);
      out.push(page);
      if (depth < maxDepth) {
        for (const link of page.links) {
          if (sameHost(root, link) && !seen.has(link)) {
            queue.push({ url: link, depth: depth + 1 });
          }
        }
      }
    } catch {
      // skip unreachable pages
    }
  }
  return out;
}

function normalizeUrl(url: string): string {
  const u = new URL(url);
  if (!["http:", "https:"].includes(u.protocol)) {
    throw new Error("only http(s) URLs supported");
  }
  return u.href;
}

async function fetchWithTimeout(
  url: string,
  init?: RequestInit,
): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      ...init,
      signal: ctrl.signal,
      headers: {
        "User-Agent": "TeamThink-Scraper/0.9",
        ...(init?.headers ?? {}),
      },
      redirect: "follow",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res;
  } finally {
    clearTimeout(timer);
  }
}

async function readLimited(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return res.text();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BYTES) throw new Error("page too large");
    chunks.push(value);
  }
  const merged = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    merged.set(c, off);
    off += c.byteLength;
  }
  return new TextDecoder().decode(merged);
}

function strip(s: string): string {
  return s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}
