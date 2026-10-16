import { defineStore } from 'pinia'
import { ref, shallowRef } from 'vue'
import { parseCandleFileName, parseCandlesCsv, type Candle, type CandleTimeframe } from '../api/mt5-candles-csv-parser'

export interface CandleFile {
  name: string
  symbol: string
  timeframe: CandleTimeframe
  size: number
  mtime: string
}

/** File nến CSV trong app/candles/ (đọc qua dev server); nội dung chỉ tải khi cần vẽ chart. */
export const useCandlesStore = defineStore('candles', () => {
  const files = ref<CandleFile[]>([])
  const state = ref<'idle' | 'loading' | 'ok' | 'unavailable'>('idle')
  // Cache nến đã đọc theo tên file (shallow: mảng lớn, không cần reactive sâu)
  const cache = shallowRef(new Map<string, Promise<Candle[]>>())

  async function list() {
    state.value = 'loading'
    try {
      const res = await fetch('/__mt5-candles/list', { cache: 'no-store' })
      if (!(res.headers.get('content-type') ?? '').includes('json')) {
        state.value = 'unavailable'
        files.value = []
        return
      }
      const body = (await res.json()) as { files: { name: string; size: number; mtime: string }[] }
      files.value = body.files.flatMap((f) => {
        const meta = parseCandleFileName(f.name)
        return meta ? [{ ...f, ...meta }] : []
      })
      cache.value = new Map() // file có thể đã được xuất lại
      state.value = 'ok'
    } catch {
      state.value = 'unavailable'
      files.value = []
    }
  }

  function load(name: string): Promise<Candle[]> {
    let p = cache.value.get(name)
    if (!p) {
      p = fetch(`/__mt5-candles/file/${encodeURIComponent(name)}`, { cache: 'no-store' })
        .then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`)
          return r.text()
        })
        .then(parseCandlesCsv)
      p.catch(() => cache.value.delete(name))
      cache.value.set(name, p)
    }
    return p
  }

  return { files, state, list, load }
})
