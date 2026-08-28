const K1 = 1.2;
const B = 0.75;

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

export interface Bm25Doc {
  id: string;
  tokens: string[];
  length: number;
}

export class Bm25Index {
  private docs: Bm25Doc[] = [];
  private df = new Map<string, number>();
  private avgLen = 0;

  constructor(texts: { id: string; text: string }[]) {
    this.docs = texts.map(({ id, text }) => {
      const tokens = tokenize(text);
      return { id, tokens, length: tokens.length };
    });
    this.avgLen =
      this.docs.reduce((s, d) => s + d.length, 0) /
      Math.max(1, this.docs.length);
    for (const doc of this.docs) {
      const seen = new Set<string>();
      for (const t of doc.tokens) {
        if (seen.has(t)) continue;
        seen.add(t);
        this.df.set(t, (this.df.get(t) ?? 0) + 1);
      }
    }
  }

  score(query: string): Map<string, number> {
    const qTokens = tokenize(query);
    const N = this.docs.length;
    const out = new Map<string, number>();
    for (const doc of this.docs) {
      let score = 0;
      const tf = new Map<string, number>();
      for (const t of doc.tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
      for (const term of qTokens) {
        const freq = tf.get(term) ?? 0;
        if (freq === 0) continue;
        const df = this.df.get(term) ?? 0;
        const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
        const denom = freq + K1 * (1 - B + (B * doc.length) / this.avgLen);
        score += idf * ((freq * (K1 + 1)) / denom);
      }
      if (score > 0) out.set(doc.id, score);
    }
    return out;
  }
}

/** Normalize scores to 0..1 for hybrid fusion. */
export function normalizeScores(scores: Map<string, number>): Map<string, number> {
  let max = 0;
  for (const v of scores.values()) max = Math.max(max, v);
  if (max <= 0) return scores;
  const out = new Map<string, number>();
  for (const [k, v] of scores) out.set(k, v / max);
  return out;
}
