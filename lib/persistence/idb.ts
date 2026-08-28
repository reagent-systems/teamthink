/**
 * IndexedDB offline cache for models metadata, RAG chunks, and Yjs snapshots.
 */

const DB_NAME = "teamthink-offline-v1";
const DB_VERSION = 1;

export type OfflineStore =
  | "models"
  | "rag"
  | "yjs"
  | "threads"
  | "artifacts";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const store of ["models", "rag", "yjs", "threads", "artifacts"] as OfflineStore[]) {
        if (!db.objectStoreNames.contains(store)) {
          db.createObjectStore(store);
        }
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function idbGet<T>(store: OfflineStore, key: string): Promise<T | null> {
  if (typeof indexedDB === "undefined") return null;
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readonly");
    const req = tx.objectStore(store).get(key);
    req.onsuccess = () => resolve((req.result as T) ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function idbSet(store: OfflineStore, key: string, value: unknown): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function idbDelete(store: OfflineStore, key: string): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function cacheYjsSnapshot(roomId: string, snapshot: Uint8Array): Promise<void> {
  await idbSet("yjs", roomId, Array.from(snapshot));
}

export async function loadYjsSnapshot(roomId: string): Promise<Uint8Array | null> {
  const raw = await idbGet<number[]>("yjs", roomId);
  return raw ? new Uint8Array(raw) : null;
}

export async function cacheThreads(roomId: string, threads: unknown): Promise<void> {
  await idbSet("threads", roomId, threads);
}

export async function loadCachedThreads(roomId: string): Promise<unknown | null> {
  return idbGet("threads", roomId);
}
