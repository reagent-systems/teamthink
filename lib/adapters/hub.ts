/**
 * Fine-tune / adapter hub — LoRA adapters shared per model (ROADMAP #87).
 */

export interface AdapterRecord {
  id: string;
  baseModel: string;
  name: string;
  repo?: string;
  description: string;
}

const ADAPTERS_KEY = "teamthink.adapters.v1";

const BUILTIN: AdapterRecord[] = [
  {
    id: "lora-smollm-chat",
    baseModel: "smollm2-360m",
    name: "SmolLM chat LoRA",
    description: "Community chat-tuned adapter for SmolLM2 360M",
  },
];

function readCustom(): AdapterRecord[] {
  if (typeof localStorage === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(ADAPTERS_KEY) ?? "[]") as AdapterRecord[];
  } catch {
    return [];
  }
}

export function listAdapters(baseModel?: string): AdapterRecord[] {
  const all = [...BUILTIN, ...readCustom()];
  if (!baseModel) return all;
  return all.filter((a) => a.baseModel === baseModel);
}

export function publishAdapter(record: Omit<AdapterRecord, "id">): AdapterRecord {
  const full: AdapterRecord = {
    ...record,
    id: `adp_${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`,
  };
  const custom = readCustom();
  custom.push(full);
  localStorage.setItem(ADAPTERS_KEY, JSON.stringify(custom));
  return full;
}
