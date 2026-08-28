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
    name: "parse_pdf",
    description: "Fetch a remote PDF URL and extract text as Markdown.",
    parameters: {
      type: "object",
      properties: { url: { type: "string" } },
      required: ["url"],
    },
  },
];

export const AGENT_MODE_PROMPT = [
  "You are in agent mode. Break the user's goal into steps:",
  "search the web, scrape relevant pages, crawl sites when needed, then answer with [1] [2] citations.",
  "Call tools until you have enough context, then give a final cited answer.",
].join("\n");
