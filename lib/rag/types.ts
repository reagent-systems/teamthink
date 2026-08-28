export interface RagDocument {
  id: string;
  roomId: string;
  name: string;
  /** Original source kind. */
  kind: "txt" | "md" | "paste";
  createdAt: number;
}

export interface RagChunk {
  id: string;
  docId: string;
  roomId: string;
  index: number;
  text: string;
  embedding: number[];
}

export interface RagSearchHit {
  chunk: RagChunk;
  score: number;
  documentName: string;
}
