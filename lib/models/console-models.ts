import { MODELS, type ModelSpec } from "@/lib/config";
import { listGridModels } from "@/lib/models/registry";

/** Sharded grid models plus local WebLLM / Transformers models (vision, etc.). */
export function listConsoleModels(): ModelSpec[] {
  const grid = listGridModels();
  const local = MODELS.filter((m) => !m.hfRepo && m.modality !== "embedding");
  const seen = new Set(grid.map((m) => m.id));
  const merged = [...grid];
  for (const m of local) {
    if (!seen.has(m.id)) {
      merged.push(m);
      seen.add(m.id);
    }
  }
  return merged;
}

export function isShardedModel(model: ModelSpec | null | undefined): boolean {
  return !!model?.hfRepo;
}

export function isVisionModel(model: ModelSpec | null | undefined): boolean {
  return model?.modality === "vision";
}
