/**
 * Dataset & eval sharing — golden prompts per room (ROADMAP #88).
 */

const DATASETS_KEY = "teamthink.evalDatasets.v1";

export interface SharedDataset {
  id: string;
  roomId: string;
  name: string;
  cases: { id: string; prompt: string; expected?: string }[];
  createdAt: number;
}

function readAll(): SharedDataset[] {
  if (typeof localStorage === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(DATASETS_KEY) ?? "[]") as SharedDataset[];
  } catch {
    return [];
  }
}

function writeAll(list: SharedDataset[]): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(DATASETS_KEY, JSON.stringify(list));
}

export function listDatasets(roomId: string): SharedDataset[] {
  return readAll().filter((d) => d.roomId === roomId);
}

export function saveDataset(ds: SharedDataset): void {
  const all = readAll();
  const idx = all.findIndex((d) => d.id === ds.id);
  if (idx >= 0) all[idx] = ds;
  else all.push(ds);
  writeAll(all);
}

export function createDataset(roomId: string, name: string): SharedDataset {
  const ds: SharedDataset = {
    id: `ds_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`,
    roomId,
    name,
    cases: [],
    createdAt: Date.now(),
  };
  saveDataset(ds);
  return ds;
}

export function exportDatasetJson(ds: SharedDataset): string {
  return JSON.stringify(ds, null, 2);
}
