/** Split plain text into retrieval-sized chunks. */
export function chunkText(text: string, maxChars = 800): string[] {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];
  const paragraphs = normalized.split(/\n{2,}/);
  const chunks: string[] = [];
  let buf = "";
  for (const para of paragraphs) {
    const piece = para.trim();
    if (!piece) continue;
    if (buf.length + piece.length + 2 <= maxChars) {
      buf = buf ? `${buf}\n\n${piece}` : piece;
    } else {
      if (buf) chunks.push(buf);
      if (piece.length <= maxChars) {
        buf = piece;
      } else {
        for (let i = 0; i < piece.length; i += maxChars) {
          chunks.push(piece.slice(i, i + maxChars));
        }
        buf = "";
      }
    }
  }
  if (buf) chunks.push(buf);
  return chunks;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom > 0 ? dot / denom : 0;
}
