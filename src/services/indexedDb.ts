import { SymbolItem, ManifestMeta, LicenseDocs, SyncDiagnostics } from '../types';

const DB_NAME = 'BicaraKuIndexedDB';
const DB_VERSION = 2;

const STORES = {
  SYMBOLS: 'symbols',
  BLOBS: 'blobs',
  META: 'meta',
} as const;

export interface StoredBlobRecord {
  id: string;
  blob: Blob;
  mimeType: string;
  updatedAt: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

// Cache Object URL lokal untuk Blob dari IndexedDB
const blobUrlCache = new Map<string, string>();

function openDatabase(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = event => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORES.SYMBOLS)) {
        db.createObjectStore(STORES.SYMBOLS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.BLOBS)) {
        db.createObjectStore(STORES.BLOBS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.META)) {
        db.createObjectStore(STORES.META, { keyPath: 'key' });
      }
      if (event.oldVersion > 0 && event.oldVersion < 2) {
        console.info(
          `[BicaraKu IDB] Skema diperbarui dari v${event.oldVersion} ke v${DB_VERSION}.`
        );
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      dbPromise = null;
      reject(request.error || new Error('Gagal membuka IndexedDB.'));
    };
  });

  return dbPromise;
}

export async function idbGetAllSymbols(): Promise<SymbolItem[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.SYMBOLS, 'readonly');
    const store = tx.objectStore(STORES.SYMBOLS);
    const req = store.getAll();
    req.onsuccess = () => resolve((req.result as SymbolItem[]) || []);
    req.onerror = () => reject(req.error);
  });
}

export async function idbPutSymbol(symbol: SymbolItem): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.SYMBOLS, 'readwrite');
    tx.objectStore(STORES.SYMBOLS).put(symbol);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function idbReplaceAllSymbols(symbols: SymbolItem[]): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.SYMBOLS, 'readwrite');
    const store = tx.objectStore(STORES.SYMBOLS);
    store.clear();
    for (const sym of symbols) {
      store.put(sym);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function idbDeleteSymbol(symbolId: string): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORES.SYMBOLS, STORES.BLOBS], 'readwrite');
    tx.objectStore(STORES.SYMBOLS).delete(symbolId);
    tx.objectStore(STORES.BLOBS).delete(symbolId);
    tx.oncomplete = () => {
      const existingUrl = blobUrlCache.get(symbolId);
      if (existingUrl) {
        URL.revokeObjectURL(existingUrl);
        blobUrlCache.delete(symbolId);
      }
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

export async function idbPutBlob(id: string, blob: Blob, mimeType?: string): Promise<string> {
  const db = await openDatabase();
  const record: StoredBlobRecord = {
    id,
    blob,
    mimeType: mimeType || blob.type || 'application/octet-stream',
    updatedAt: Date.now(),
  };

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORES.BLOBS, 'readwrite');
    tx.objectStore(STORES.BLOBS).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  // Perbarui cache Object URL
  const prevUrl = blobUrlCache.get(id);
  if (prevUrl) {
    URL.revokeObjectURL(prevUrl);
  }
  const objectUrl = URL.createObjectURL(blob);
  blobUrlCache.set(id, objectUrl);
  return objectUrl;
}

export async function idbGetBlob(id: string): Promise<StoredBlobRecord | null> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.BLOBS, 'readonly');
    const req = tx.objectStore(STORES.BLOBS).get(id);
    req.onsuccess = () => resolve((req.result as StoredBlobRecord) || null);
    req.onerror = () => reject(req.error);
  });
}

export async function idbPreloadAllBlobUrls(): Promise<Record<string, string>> {
  const db = await openDatabase();
  const records = await new Promise<StoredBlobRecord[]>((resolve, reject) => {
    const tx = db.transaction(STORES.BLOBS, 'readonly');
    const req = tx.objectStore(STORES.BLOBS).getAll();
    req.onsuccess = () => resolve((req.result as StoredBlobRecord[]) || []);
    req.onerror = () => reject(req.error);
  });

  const result: Record<string, string> = {};
  for (const rec of records) {
    if (rec?.id && rec?.blob) {
      let url = blobUrlCache.get(rec.id);
      if (!url) {
        url = URL.createObjectURL(rec.blob);
        blobUrlCache.set(rec.id, url);
      }
      result[rec.id] = url;
    }
  }
  return result;
}

export function getCachedBlobUrl(id: string): string | undefined {
  return blobUrlCache.get(id);
}

export async function idbGetMeta<T>(key: string): Promise<T | null> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.META, 'readonly');
    const req = tx.objectStore(STORES.META).get(key);
    req.onsuccess = () => {
      const row = req.result as { key: string; value: T } | undefined;
      resolve(row ? row.value : null);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function idbSetMeta<T>(key: string, value: T): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.META, 'readwrite');
    tx.objectStore(STORES.META).put({ key, value });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export const META_KEYS = {
  MANIFEST: 'manifestMeta',
  LICENSE_DOCS: 'licenseDocs',
  ORDER: 'symbolOrder',
  DIAGNOSTICS: 'syncDiagnostics',
} as const;

export async function getManifestMeta(): Promise<ManifestMeta | null> {
  return idbGetMeta<ManifestMeta>(META_KEYS.MANIFEST);
}

export async function setManifestMeta(meta: ManifestMeta): Promise<void> {
  return idbSetMeta(META_KEYS.MANIFEST, meta);
}

export async function getLicenseDocs(): Promise<LicenseDocs | null> {
  return idbGetMeta<LicenseDocs>(META_KEYS.LICENSE_DOCS);
}

export async function setLicenseDocs(docs: LicenseDocs): Promise<void> {
  return idbSetMeta(META_KEYS.LICENSE_DOCS, docs);
}

export async function getSyncDiagnostics(): Promise<SyncDiagnostics | null> {
  return idbGetMeta<SyncDiagnostics>(META_KEYS.DIAGNOSTICS);
}

export async function setSyncDiagnostics(diag: SyncDiagnostics): Promise<void> {
  return idbSetMeta(META_KEYS.DIAGNOSTICS, diag);
}

export async function idbDeleteBlob(id: string): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.BLOBS, 'readwrite');
    tx.objectStore(STORES.BLOBS).delete(id);
    tx.oncomplete = () => {
      const existingUrl = blobUrlCache.get(id);
      if (existingUrl) {
        URL.revokeObjectURL(existingUrl);
        blobUrlCache.delete(id);
      }
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}
