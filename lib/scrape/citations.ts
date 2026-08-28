import type { Citation } from "@/lib/scrape/types";

const KEY = "teamthink.citations.v1";

function read(): Record<string, Citation[]> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<string, Citation[]>;
  } catch {
    return {};
  }
}

function write(map: Record<string, Citation[]>): void {
  localStorage.setItem(KEY, JSON.stringify(map));
}

export function getCitations(roomId: string): Citation[] {
  return read()[roomId] ?? [];
}

export function setCitations(roomId: string, citations: Citation[]): void {
  const map = read();
  map[roomId] = citations;
  write(map);
}

export function mergeCitations(roomId: string, next: Citation[]): Citation[] {
  const existing = getCitations(roomId);
  const byUrl = new Map(existing.map((c) => [c.url, c]));
  let maxId = existing.reduce((m, c) => Math.max(m, c.id), 0);
  for (const c of next) {
    if (byUrl.has(c.url)) continue;
    maxId += 1;
    byUrl.set(c.url, { ...c, id: maxId });
  }
  const merged = [...byUrl.values()].sort((a, b) => a.id - b.id);
  setCitations(roomId, merged);
  return merged;
}

export function clearCitations(roomId: string): void {
  const map = read();
  delete map[roomId];
  write(map);
}

export function citationById(roomId: string, id: number): Citation | undefined {
  return getCitations(roomId).find((c) => c.id === id);
}
