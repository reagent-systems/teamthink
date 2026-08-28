import { DEFAULT_EMBEDDING_MODEL_ID } from "@/lib/config";
import { InferenceClient } from "@/lib/engine/worker-client";
import { chunkText, cosineSimilarity } from "@/lib/rag/chunk";
import type { RagChunk, RagDocument, RagSearchHit } from "@/lib/rag/types";

const DOCS_KEY = "teamthink.rag.docs.v1";
const CHUNKS_KEY = "teamthink.rag.chunks.v1";

let embedClient: InferenceClient | null = null;

function client(): InferenceClient {
  embedClient ??= new InferenceClient();
  return embedClient;
}

function readDocs(): RagDocument[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(DOCS_KEY) ?? "[]") as RagDocument[];
  } catch {
    return [];
  }
}

function writeDocs(docs: RagDocument[]): void {
  localStorage.setItem(DOCS_KEY, JSON.stringify(docs));
}

function readChunks(): RagChunk[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(CHUNKS_KEY) ?? "[]") as RagChunk[];
  } catch {
    return [];
  }
}

function writeChunks(chunks: RagChunk[]): void {
  localStorage.setItem(CHUNKS_KEY, JSON.stringify(chunks));
}

export function listDocuments(roomId: string): RagDocument[] {
  return readDocs()
    .filter((d) => d.roomId === roomId)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export function deleteDocument(docId: string): void {
  writeDocs(readDocs().filter((d) => d.id !== docId));
  writeChunks(readChunks().filter((c) => c.docId !== docId));
}

async function embedTexts(texts: string[]): Promise<number[][]> {
  return client().embed(DEFAULT_EMBEDDING_MODEL_ID, texts);
}

/** Ingest plain text, chunk, embed, and store for the room knowledge base. */
export async function ingestText(
  roomId: string,
  name: string,
  text: string,
  kind: RagDocument["kind"] = "paste",
): Promise<RagDocument> {
  const doc: RagDocument = {
    id: `doc_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`,
    roomId,
    name,
    kind,
    createdAt: Date.now(),
  };
  const pieces = chunkText(text);
  if (pieces.length === 0) throw new Error("No text to index");

  const vectors = await embedTexts(pieces);
  const chunks: RagChunk[] = pieces.map((t, i) => ({
    id: `chk_${doc.id}_${i}`,
    docId: doc.id,
    roomId,
    index: i,
    text: t,
    embedding: vectors[i] ?? [],
  }));

  writeDocs([doc, ...readDocs()]);
  writeChunks([...chunks, ...readChunks()]);
  return doc;
}

/** Top-k semantic search over indexed chunks for a room. */
export async function searchChunks(
  roomId: string,
  query: string,
  k = 4,
): Promise<RagSearchHit[]> {
  const chunks = readChunks().filter((c) => c.roomId === roomId);
  if (chunks.length === 0) return [];
  const docs = new Map(listDocuments(roomId).map((d) => [d.id, d.name]));
  const [queryVec] = await embedTexts([query]);
  if (!queryVec) return [];

  const scored = chunks
    .map((chunk) => ({
      chunk,
      score: cosineSimilarity(queryVec, chunk.embedding),
      documentName: docs.get(chunk.docId) ?? "document",
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k);

  return scored.filter((h) => h.score > 0.15);
}

/** Format retrieved chunks as prompt context with simple citations. */
export function formatRagContext(hits: RagSearchHit[]): string {
  if (hits.length === 0) return "";
  return hits
    .map(
      (h, i) =>
        `[${i + 1}] (${h.documentName}, score ${h.score.toFixed(2)})\n${h.chunk.text}`,
    )
    .join("\n\n");
}

export async function retrieveContext(
  roomId: string,
  query: string,
): Promise<string> {
  const hits = await searchChunks(roomId, query);
  return formatRagContext(hits);
}
