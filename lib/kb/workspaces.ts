import { ingestText, listDocuments, deleteDocument } from "@/lib/rag/store";
import { scrapeUrl } from "@/lib/scrape/client";
import { getScrapeSettings } from "@/lib/scrape/settings";
import { redactPii } from "@/lib/scrape/pii";

const KEY = "teamthink.kb.workspaces.v1";

export interface KnowledgeWorkspace {
  id: string;
  roomId: string;
  name: string;
  docIds: string[];
  sourceUrls: string[];
  createdAt: number;
  updatedAt: number;
}

function read(): KnowledgeWorkspace[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as KnowledgeWorkspace[];
  } catch {
    return [];
  }
}

function write(ws: KnowledgeWorkspace[]): void {
  localStorage.setItem(KEY, JSON.stringify(ws));
}

export function listWorkspaces(roomId: string): KnowledgeWorkspace[] {
  return read()
    .filter((w) => w.roomId === roomId)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export function createWorkspace(roomId: string, name: string): KnowledgeWorkspace {
  const now = Date.now();
  const ws: KnowledgeWorkspace = {
    id: `kb_${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`,
    roomId,
    name: name.trim() || "Workspace",
    docIds: [],
    sourceUrls: [],
    createdAt: now,
    updatedAt: now,
  };
  write([ws, ...read()]);
  return ws;
}

export function deleteWorkspace(id: string): void {
  write(read().filter((w) => w.id !== id));
}

export function patchWorkspace(
  id: string,
  patch: Partial<KnowledgeWorkspace>,
): KnowledgeWorkspace | null {
  const all = read();
  const idx = all.findIndex((w) => w.id === id);
  if (idx < 0) return null;
  all[idx] = { ...all[idx]!, ...patch, updatedAt: Date.now() };
  write(all);
  return all[idx]!;
}

/** Scrape a URL and ingest into the workspace knowledge base. */
export async function ingestUrlToWorkspace(
  workspaceId: string,
  url: string,
): Promise<KnowledgeWorkspace | null> {
  const all = read();
  const ws = all.find((w) => w.id === workspaceId);
  if (!ws) return null;
  const page = await scrapeUrl(url);
  let md = page.markdown;
  if (getScrapeSettings().redactPii) md = redactPii(md);
  const doc = await ingestText(ws.roomId, page.title || url, md, "paste");
  return patchWorkspace(workspaceId, {
    docIds: [...new Set([...ws.docIds, doc.id])],
    sourceUrls: [...new Set([...ws.sourceUrls, url])],
  });
}

export function workspaceDocuments(workspaceId: string) {
  const ws = read().find((w) => w.id === workspaceId);
  if (!ws) return [];
  const docs = listDocuments(ws.roomId);
  return docs.filter((d) => ws.docIds.includes(d.id));
}

export function removeDocFromWorkspace(workspaceId: string, docId: string): void {
  const ws = read().find((w) => w.id === workspaceId);
  if (!ws) return;
  patchWorkspace(workspaceId, { docIds: ws.docIds.filter((id) => id !== docId) });
  deleteDocument(docId);
}
