/**
 * Lưu file báo cáo / nến ngay trong trình duyệt (IndexedDB) khi chạy bản deploy tĩnh (Vercel) — không có dev server.
 * Dữ liệu chỉ nằm trên máy / trình duyệt này, không gửi lên server.
 */
export type StoredKind = 'report' | 'candle'
export interface StoredFileMeta { name: string; size: number; mtime: string }
interface StoredFile extends StoredFileMeta { key: string; kind: StoredKind; data: ArrayBuffer }

const DB_NAME = 'exness-dashboard'
const STORE = 'files'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('Trình duyệt không hỗ trợ IndexedDB'))
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'key' }).createIndex('kind', 'kind')
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('Không mở được IndexedDB'))
  })
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode)
    const req = fn(t.objectStore(STORE))
    let result: T | undefined
    if (req) req.onsuccess = () => (result = req.result)
    t.oncomplete = () => {
      db.close()
      resolve(result)
    }
    t.onerror = () => {
      db.close()
      reject(t.error ?? new Error('Lỗi IndexedDB'))
    }
  })
}

const keyOf = (kind: StoredKind, name: string) => `${kind}/${name}`

export async function listStoredFiles(kind: StoredKind): Promise<StoredFileMeta[]> {
  const all = (await tx<StoredFile[]>('readonly', (s) => s.index('kind').getAll(kind))) ?? []
  return all.map(({ name, size, mtime }) => ({ name, size, mtime })).sort((a, b) => a.name.localeCompare(b.name))
}

export async function readStoredFile(kind: StoredKind, name: string): Promise<ArrayBuffer> {
  const f = await tx<StoredFile>('readonly', (s) => s.get(keyOf(kind, name)))
  if (!f) throw new Error('Không tìm thấy file trong trình duyệt')
  return f.data
}

/** Thêm / ghi đè file (cùng tên thì thay) */
export async function storeFiles(kind: StoredKind, files: File[]): Promise<void> {
  const items = await Promise.all(files.map(async (f): Promise<StoredFile> => ({
    key: keyOf(kind, f.name), kind, name: f.name, size: f.size, mtime: new Date(f.lastModified || Date.now()).toISOString(), data: await f.arrayBuffer(),
  })))
  await tx('readwrite', (s) => {
    for (const it of items) s.put(it)
  })
}

export async function deleteStoredFile(kind: StoredKind, name: string): Promise<void> {
  await tx('readwrite', (s) => s.delete(keyOf(kind, name)))
}
