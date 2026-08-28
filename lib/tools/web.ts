import type { ToolDefinition } from "@/lib/tools/types";

export const WEB_TOOLS: ToolDefinition[] = [
  {
    name: "web_scrape",
    description: "Fetch a URL and return clean Markdown plus outbound links.",
    parameters: {
      type: "object",
      properties: { url: { type: "string", description: "HTTP(S) URL to scrape" } },
      required: ["url"],
    },
  },
  {
    name: "web_crawl",
    description: "Crawl a domain from a start URL (depth/page limits) into Markdown pages.",
    parameters: {
      type: "object",
      properties: {
        url: { type: "string" },
        max_depth: { type: "number", description: "0–3, default 1" },
        max_pages: { type: "number", description: "1–25, default 8" },
      },
      required: ["url"],
    },
  },
  {
    name: "web_sitemap",
    description: "List outbound links discovered on a page (fast URL inventory).",
    parameters: {
      type: "object",
      properties: { url: { type: "string" } },
      required: ["url"],
    },
  },
  {
    name: "web_search",
    description: "Search the web and return ranked results with snippets.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string" },
        limit: { type: "number", description: "1–8, default 5" },
      },
      required: ["query"],
    },
  },
  {
    name: "news_search",
    description: "Search recent news articles for a query.",
    parameters: {
      type: "object",
      properties: { query: { type: "string" }, limit: { type: "number" } },
      required: ["query"],
    },
  },
  {
    name: "image_search",
    description: "Search for images matching a query; returns URLs and thumbnails.",
    parameters: {
      type: "object",
      properties: { query: { type: "string" }, limit: { type: "number" } },
      required: ["query"],
    },
  },
  {
    name: "parse_pdf",
    description: "Fetch a remote PDF URL and extract text as Markdown.",
    parameters: {
      type: "object",
      properties: { url: { type: "string" } },
      required: ["url"],
    },
  },
  {
    name: "extract_json",
    description: "Extract JSON-LD, Open Graph, and tables from a page URL.",
    parameters: {
      type: "object",
      properties: {
        url: { type: "string" },
        schema_hint: { type: "string", description: "Optional schema guidance" },
      },
      required: ["url"],
    },
  },
  {
    name: "browser_interact",
    description: "Wait and re-snapshot a URL (static fetch; JS click/type simulated).",
    parameters: {
      type: "object",
      properties: {
        url: { type: "string" },
        actions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              type: { type: "string", enum: ["wait", "scroll", "click", "type", "resnapshot"] },
              ms: { type: "number" },
              selector: { type: "string" },
              text: { type: "string" },
            },
          },
        },
      },
      required: ["url", "actions"],
    },
  },
  {
    name: "batch_scrape",
    description: "Queue multiple URLs for background scrape (returns job id).",
    parameters: {
      type: "object",
      properties: {
        urls: { type: "array", items: { type: "string" } },
        ingest_to_rag: { type: "boolean" },
      },
      required: ["urls"],
    },
  },
];

export const AGENT_MODE_PROMPT = [
  "You are in agent mode. Break the user's goal into steps:",
  "search the web, scrape relevant pages, crawl sites when needed, then answer with [1] [2] citations.",
  "Call tools until you have enough context, then give a final cited answer.",
].join("\n");
