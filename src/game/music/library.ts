/** Tiny IndexedDB store so songs added through the game stay on the player's own computer. */
const DB_NAME = "pixelruggas-music";
const STORE = "tracks";

export interface StoredTrack {
  id: string;
  name: string;
  blob: Blob;
  added: number;
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB error"));
  });
}

function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = run(t.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error ?? new Error("IndexedDB error"));
        t.oncomplete = () => db.close();
      }),
  );
}

export async function listStored(): Promise<StoredTrack[]> {
  try {
    const all = await tx<StoredTrack[]>("readonly", (s) => s.getAll() as IDBRequest<StoredTrack[]>);
    return all.sort((a, b) => a.added - b.added);
  } catch {
    return [];
  }
}

export async function addStored(file: File): Promise<StoredTrack | null> {
  const rec: StoredTrack = {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    name: file.name,
    blob: file,
    added: Date.now(),
  };
  try {
    await tx("readwrite", (s) => s.put(rec));
    return rec;
  } catch {
    return null;
  }
}

export async function removeStored(id: string): Promise<void> {
  try {
    await tx("readwrite", (s) => s.delete(id));
  } catch {
    /* ignore */
  }
}
