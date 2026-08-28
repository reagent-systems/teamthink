import {
  SHARDED_MODELS,
  type ModelModality,
  type ModelSpec,
} from "@/lib/config";

const CUSTOM_KEY = "teamthink.customModels.v1";

export interface CustomModelEntry {
  id: string;
  label: string;
  hfRepo: string;
  modality: ModelModality;
  vramMb: number;
  addedAt: number;
}

function canUseStorage(): boolean {
  return typeof window !== "undefined" && !!window.localStorage;
}

function readCustom(): CustomModelEntry[] {
  if (!canUseStorage()) return [];
  try {
    return JSON.parse(
      localStorage.getItem(CUSTOM_KEY) ?? "[]",
    ) as CustomModelEntry[];
  } catch {
    return [];
  }
}

function writeCustom(entries: CustomModelEntry[]): void {
  if (!canUseStorage()) return;
  localStorage.setItem(CUSTOM_KEY, JSON.stringify(entries));
}

export function listCustomModels(): CustomModelEntry[] {
  return readCustom().sort((a, b) => b.addedAt - a.addedAt);
}

export function customToSpec(entry: CustomModelEntry): ModelSpec {
  return {
    id: entry.id,
    label: entry.label,
    engine: "transformers",
    modality: entry.modality,
    modelId: entry.hfRepo,
    vramMb: entry.vramMb,
    hfRepo: entry.hfRepo,
  };
}

/** Built-in sharded models plus user-added registry entries. */
export function listGridModels(): ModelSpec[] {
  const builtins = [...SHARDED_MODELS];
  const custom = listCustomModels().map(customToSpec);
  const seen = new Set(builtins.map((m) => m.hfRepo));
  for (const m of custom) {
    if (m.hfRepo && !seen.has(m.hfRepo)) {
      builtins.push(m);
      seen.add(m.hfRepo);
    }
  }
  return builtins;
}

export function getGridModel(id: string): ModelSpec | undefined {
  return listGridModels().find((m) => m.id === id);
}

export function addCustomModel(spec: {
  hfRepo: string;
  label?: string;
  modality?: ModelModality;
  vramMb?: number;
}): ModelSpec {
  const repo = spec.hfRepo.trim();
  const existing = readCustom().find((e) => e.hfRepo === repo);
  if (existing) return customToSpec(existing);

  const slug = repo.replace(/[^\w]+/g, "-").slice(0, 40);
  const entry: CustomModelEntry = {
    id: `grid-custom-${slug}`,
    label: spec.label ?? repo.split("/").pop() ?? repo,
    hfRepo: repo,
    modality: spec.modality ?? "text",
    vramMb: spec.vramMb ?? 0,
    addedAt: Date.now(),
  };
  writeCustom([entry, ...readCustom()]);
  return customToSpec(entry);
}

export function removeCustomModel(id: string): void {
  writeCustom(readCustom().filter((e) => e.id !== id));
}

export function isCustomModelId(id: string): boolean {
  return id.startsWith("grid-custom-");
}
