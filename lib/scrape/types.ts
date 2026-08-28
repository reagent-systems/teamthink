export interface ScrapeResult {
  url: string;
  title: string;
  markdown: string;
  links: string[];
}

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  kind?: "web" | "news" | "image";
  imageUrl?: string;
}

export interface Citation {
  id: number;
  url: string;
  title: string;
}
