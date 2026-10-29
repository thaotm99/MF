import { defineStore } from 'pinia'
import { ref, shallowRef } from 'vue'
import { parseCandleFileName, parseCandlesCsv, type Candle, type CandleTimeframe } from '../api/mt5-candles-csv-parser'
import { deleteStoredFile, listStoredFiles, readStoredFile, storeFiles } from './browser-file-storage'

export interface CandleFile {
  name: string
  symbol: string
  timeframe: CandleTimeframe
  size: number
  mtime: string
}

/**
 * File nến CSV: app/candles/ qua dev server, hoặc (bản deploy tĩnh) file nạp trên trình duyệt (IndexedDB).
 * Nội dung chỉ tải khi cần vẽ chart.
 */
export const useCandlesStore = defineStore('candles', () => {
  const files = ref<CandleFile[]>([])
  const state = ref<'idle' | 'loading' | 'ok' | 'unavailable'>('idle')
  // Cache nến đã đọc theo tên file (shallow: mảng lớn, không cần reactive sâu)
  const cache = shallowRef(new Map<string, Promise<Candle[]>>())
  const source = ref<'server' | 'browser'>('server')

  async function listFromBrowser() {
    source.value = 'browser'
    try {
      const metas = await listStoredFiles('candle')
      files.value = metas.flatMap((f) => {
        const meta = parseCandleFileName(f.name)
        return meta ? [{ ...f, ...meta }] : []
      })
      cache.value = new Map()
      state.value = 'ok'
    } catch {
      files.value = []
      state.value = 'unavailable'
    }
  }
  /** Nạp file nến (.csv, tên dạng XAUUSDc_M5.csv) vào trình duyệt */
  async function importFiles(list: File[]) {
    await storeFiles('candle', list.filter((f) => /\.csv$/i.test(f.name)))
    await listFromBrowser()
  }
  async function removeFile(name: string) {
    await deleteStoredFile('candle', name)
    await listFromBrowser()
  }

  async function list() {
    state.value = 'loading'
    try {
      const res = await fetch('/__mt5-candles/list', { cache: 'no-store' })
      if (!(res.headers.get('content-type') ?? '').includes('json')) return listFromBrowser()
      source.value = 'server'
      const body = (await res.json()) as { files: { name: string; size: number; mtime: string }[] }
      files.value = body.files.flatMap((f) => {
        const meta = parseCandleFileName(f.name)
        return meta ? [{ ...f, ...meta }] : []
      })
      cache.value = new Map() // file có thể đã được xuất lại
      state.value = 'ok'
    } catch {
      await listFromBrowser()
    }
  }

  function load(name: string): Promise<Candle[]> {
    let p = cache.value.get(name)
    if (!p) {
      const text = source.value === 'browser'
        ? readStoredFile('candle', name).then((buf) => new TextDecoder().decode(buf))
        : fetch(`/__mt5-candles/file/${encodeURIComponent(name)}`, { cache: 'no-store' }).then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`)
          return r.text()
        })
      p = text.then(parseCandlesCsv)
      p.catch(() => cache.value.delete(name))
      cache.value.set(name, p)
    }
    return p
  }

  return { files, state, source, list, load, importFiles, removeFile }
})
