import { scrapeUrl } from "@/lib/scrape/client";

const KEY = "teamthink.scrape.watch.v1";
export const WATCH_EVENT = "teamthink:watch-update";

export interface WatchedUrl {
  id: string;
  roomId: string;
  url: string;
  lastHash: string;
  lastChecked: number;
  lastTitle: string;
  changed: boolean;
}

function hash(text: string): string {
  let h = 0;
  for (let i = 0; i < text.length; i++) {
    h = (Math.imul(31, h) + text.charCodeAt(i)) | 0;
  }
  return String(h);
}

function read(): WatchedUrl[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as WatchedUrl[];
  } catch {
    return [];
  }
}

function write(items: WatchedUrl[]): void {
  localStorage.setItem(KEY, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent(WATCH_EVENT));
}

export function listWatchedUrls(roomId: string): WatchedUrl[] {
  return read().filter((w) => w.roomId === roomId);
}

export function addWatchedUrl(roomId: string, url: string): WatchedUrl {
  const item: WatchedUrl = {
    id: `watch_${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`,
    roomId,
    url: url.trim(),
    lastHash: "",
    lastChecked: 0,
    lastTitle: "",
    changed: false,
  };
  write([item, ...read()]);
  return item;
}

export function removeWatchedUrl(id: string): void {
  write(read().filter((w) => w.id !== id));
}

export async function checkWatchedUrl(id: string): Promise<WatchedUrl | null> {
  const items = read();
  const idx = items.findIndex((w) => w.id === id);
  if (idx < 0) return null;
  const item = items[idx]!;
  try {
    const page = await scrapeUrl(item.url);
    const contentHash = hash(page.markdown);
    const changed = item.lastHash !== "" && item.lastHash !== contentHash;
    const next = {
      ...item,
      lastHash: contentHash,
      lastChecked: Date.now(),
      lastTitle: page.title,
      changed,
    };
    items[idx] = next;
    write(items);
    return next;
  } catch {
    return item;
  }
}

export async function checkAllWatched(roomId: string): Promise<WatchedUrl[]> {
  const items = listWatchedUrls(roomId);
  const out: WatchedUrl[] = [];
  for (const w of items) {
    const checked = await checkWatchedUrl(w.id);
    if (checked) out.push(checked);
  }
  return out;
}
