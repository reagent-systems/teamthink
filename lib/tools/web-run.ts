import {
  crawlSite,
  discoverSiteMap,
  formatScrapeForTool,
  pagesToCitations,
  parsePdfUrl,
  scrapeUrl,
  webSearch,
} from "@/lib/scrape/client";
import { mergeCitations } from "@/lib/scrape/citations";
import type { ToolCall, ToolContext, ToolResult } from "@/lib/tools/types";

export async function runWebTool(
  call: ToolCall,
  ctx: ToolContext,
): Promise<ToolResult | null> {
  switch (call.name) {
    case "web_scrape": {
      const url = String(call.arguments.url ?? "");
      const page = await scrapeUrl(url);
      mergeCitations(ctx.roomId, pagesToCitations([page]));
      return { name: call.name, output: formatScrapeForTool(page) };
    }
    case "web_crawl": {
      const url = String(call.arguments.url ?? "");
      const maxDepth = Number(call.arguments.max_depth ?? 1);
      const maxPages = Number(call.arguments.max_pages ?? 8);
      const pages = await crawlSite(url, maxDepth, maxPages);
      mergeCitations(ctx.roomId, pagesToCitations(pages));
      const body = pages
        .map((p, i) => `--- Page ${i + 1}: ${p.title} (${p.url}) ---\n${p.markdown.slice(0, 4000)}`)
        .join("\n\n");
      return { name: call.name, output: body || "No pages crawled." };
    }
    case "web_sitemap": {
      const url = String(call.arguments.url ?? "");
      const links = await discoverSiteMap(url);
      return {
        name: call.name,
        output: links.slice(0, 100).join("\n") || "No links found.",
      };
    }
    case "web_search": {
      const query = String(call.arguments.query ?? "");
      const limit = Number(call.arguments.limit ?? 5);
      const hits = await webSearch(query, limit);
      mergeCitations(
        ctx.roomId,
        hits.map((h, i) => ({ id: i + 1, url: h.url, title: h.title })),
      );
      return {
        name: call.name,
        output: hits
          .map((h, i) => `[${i + 1}] ${h.title}\n${h.url}\n${h.snippet}`)
          .join("\n\n"),
      };
    }
    case "parse_pdf": {
      const url = String(call.arguments.url ?? "");
      const doc = await parsePdfUrl(url);
      mergeCitations(ctx.roomId, [
        { id: 1, url: doc.url, title: `PDF: ${doc.url}` },
      ]);
      return { name: call.name, output: doc.markdown || "(no text extracted)" };
    }
    default:
      return null;
  }
}
