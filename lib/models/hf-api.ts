/**
 * Hugging Face Hub search helpers for the in-app model browser.
 * Uses the public HF API (no token required for public models).
 */

export type HfModalityFilter = "all" | "text" | "vision" | "embedding";

export interface HfModelHit {
  id: string;
  modelId: string;
  author: string;
  downloads: number;
  likes: number;
  tags: string[];
  pipeline_tag: string | null;
  /** Parameter count when HF exposes it (e.g. "1B", "360M"). */
  paramLabel: string | null;
  safetensors: boolean;
  gated: boolean;
  private: boolean;
}

const HF_API = "https://huggingface.co/api/models";

function parseParamLabel(modelId: string, tags: string[]): string | null {
  for (const t of tags) {
    const m = /^(\d+(?:\.\d+)?[bmk])$/i.exec(t);
    if (m) return m[1].toUpperCase();
  }
  const fromId = /(\d+(?:\.\d+)?[BbMmKk])/.exec(modelId);
  return fromId ? fromId[1].toUpperCase() : null;
}

function modalityFromHit(hit: {
  pipeline_tag?: string | null;
  tags?: string[];
}): "text" | "vision" | "embedding" | null {
  const tag = hit.pipeline_tag ?? "";
  const tags = hit.tags ?? [];
  if (
    tag === "text-generation" ||
    tag === "text2text-generation" ||
    tags.includes("conversational")
  ) {
    return "text";
  }
  if (
    tag === "image-text-to-text" ||
    tag === "visual-question-answering" ||
    tags.includes("vision")
  ) {
    return "vision";
  }
  if (tag === "feature-extraction" || tags.includes("sentence-similarity")) {
    return "embedding";
  }
  return null;
}

function mapHit(raw: Record<string, unknown>): HfModelHit | null {
  const modelId = String(raw.id ?? raw.modelId ?? "");
  if (!modelId || raw.private === true) return null;
  const tags = Array.isArray(raw.tags) ? (raw.tags as string[]) : [];
  return {
    id: modelId,
    modelId,
    author: String(raw.author ?? modelId.split("/")[0] ?? ""),
    downloads: Number(raw.downloads ?? 0),
    likes: Number(raw.likes ?? 0),
    tags,
    pipeline_tag: (raw.pipeline_tag as string | null) ?? null,
    paramLabel: parseParamLabel(modelId, tags),
    safetensors: tags.includes("safetensors"),
    gated: raw.gated === true || raw.gated === "auto",
    private: raw.private === true,
  };
}

export interface SearchModelsOptions {
  query: string;
  modality?: HfModalityFilter;
  /** Prefer safetensors weights (required for grid sharding). */
  safetensorsOnly?: boolean;
  limit?: number;
}

export async function searchHfModels(
  options: SearchModelsOptions,
): Promise<HfModelHit[]> {
  const { query, modality = "all", safetensorsOnly = true, limit = 24 } =
    options;
  const params = new URLSearchParams({
    search: query.trim() || "instruct",
    sort: "downloads",
    direction: "-1",
    limit: String(Math.min(limit, 50)),
  });
  if (modality === "text") {
    params.set("filter", "text-generation");
  } else if (modality === "vision") {
    params.set("filter", "image-text-to-text");
  } else if (modality === "embedding") {
    params.set("filter", "feature-extraction");
  }
  const res = await fetch(`${HF_API}?${params}`);
  if (!res.ok) {
    throw new Error(`Hugging Face search failed (${res.status})`);
  }
  const raw = (await res.json()) as Record<string, unknown>[];
  let hits = raw.map(mapHit).filter((h): h is HfModelHit => h != null);
  if (safetensorsOnly) {
    hits = hits.filter((h) => h.safetensors);
  }
  if (modality !== "all") {
    hits = hits.filter((h) => modalityFromHit(h) === modality);
  }
  return hits.filter((h) => !h.gated);
}

export async function fetchHfModel(modelId: string): Promise<HfModelHit | null> {
  const res = await fetch(`${HF_API}/${encodeURIComponent(modelId)}`);
  if (!res.ok) return null;
  const raw = (await res.json()) as Record<string, unknown>;
  return mapHit(raw);
}

/** Rough param count from label like "1.5B" → 1.5e9 */
export function paramLabelToBillions(label: string | null): number | null {
  if (!label) return null;
  const m = /^(\d+(?:\.\d+)?)\s*([bmk])$/i.exec(label.replace(/\s/g, ""));
  if (!m) return null;
  const n = parseFloat(m[1]);
  const u = m[2].toLowerCase();
  if (u === "b") return n;
  if (u === "m") return n / 1000;
  if (u === "k") return n / 1_000_000;
  return null;
}

/** Filter hits by max parameter size (billions). */
export function filterByMaxParams(
  hits: HfModelHit[],
  maxB: number | null,
): HfModelHit[] {
  if (maxB == null) return hits;
  return hits.filter((h) => {
    const b = paramLabelToBillions(h.paramLabel);
    return b == null || b <= maxB;
  });
}

/** Detect quant hints from model id / tags for the quant picker filter. */
export function quantHint(hit: HfModelHit): string | null {
  const id = hit.modelId.toLowerCase();
  if (/q[458]_?k?/.test(id) || hit.tags.some((t) => /4-bit|8-bit|quant/i.test(t))) {
    if (/q4/.test(id)) return "q4";
    if (/q5/.test(id)) return "q5";
    if (/q8/.test(id)) return "q8";
    return "quant";
  }
  if (/f16|fp16|bf16/.test(id)) return "f16";
  if (/f32|fp32/.test(id)) return "f32";
  return null;
}

export function filterByQuant(
  hits: HfModelHit[],
  quant: "all" | "q4" | "q8" | "f16",
): HfModelHit[] {
  if (quant === "all") return hits;
  return hits.filter((h) => {
    const q = quantHint(h);
    if (quant === "q4") return q === "q4" || q === "quant";
    if (quant === "q8") return q === "q8";
    if (quant === "f16") return q === "f16";
    return true;
  });
}
