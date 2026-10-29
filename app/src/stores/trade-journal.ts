import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export interface JournalEntry {
  tags: string[]
  note: string
  updatedAt: string
}

/** Nhãn gợi ý sẵn; người dùng có thể thêm nhãn riêng */
export const PRESET_TAGS = ['Đúng setup', 'Sai cấu trúc', 'Vào sớm', 'Vào muộn', 'Thoát sớm', 'Thoát muộn', 'Tin tức', 'Khác']

/** Chờ ngừng gõ rồi mới ghi file */
const SAVE_DELAY_MS = 600

/**
 * Nhật ký nhãn / ghi chú theo ID vị thế (ticket MT5), lưu ở app/journal/trade-journal.json qua dev server.
 * Ghi lại cả file mỗi lần đổi (nhật ký nhỏ, đơn giản & không lệch giữa các tab).
 */
export const useTradeJournalStore = defineStore('trade-journal', () => {
  const entries = ref<Record<string, JournalEntry>>({})
  const state = ref<'idle' | 'loading' | 'ok' | 'unavailable'>('idle')
  const saving = ref<'idle' | 'saving' | 'saved' | 'error'>('idle')
  let timer: ReturnType<typeof setTimeout> | undefined
  /** Lưu ở file (dev server) hay localStorage của trình duyệt (bản deploy tĩnh) */
  const backend = ref<'server' | 'browser'>('server')
  const LOCAL_KEY = 'mf-trade-journal-v1'

  async function load() {
    state.value = 'loading'
    try {
      const res = await fetch('/__trade-journal', { cache: 'no-store' })
      if (!res.ok || !(res.headers.get('content-type') ?? '').includes('json')) throw new Error()
      entries.value = (await res.json()) as Record<string, JournalEntry>
      state.value = 'ok'
    } catch {
      // Không có dev server (bản deploy) → localStorage
      backend.value = 'browser'
      try {
        entries.value = JSON.parse(localStorage.getItem(LOCAL_KEY) ?? '{}') as Record<string, JournalEntry>
        state.value = 'ok'
      } catch {
        state.value = 'unavailable'
      }
    }
  }
  const ensureLoaded = () => (state.value === 'idle' ? load() : Promise.resolve())

  async function flush() {
    saving.value = 'saving'
    if (backend.value === 'browser') {
      try {
        localStorage.setItem(LOCAL_KEY, JSON.stringify(entries.value))
        saving.value = 'saved'
      } catch {
        saving.value = 'error'
      }
      return
    }
    try {
      const res = await fetch('/__trade-journal', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(entries.value),
      })
      saving.value = res.ok ? 'saved' : 'error'
    } catch {
      saving.value = 'error'
    }
  }

  /** Cập nhật nhãn / ghi chú của một lệnh; bỏ hẳn mục nếu trống */
  function set(id: string, patch: Partial<Pick<JournalEntry, 'tags' | 'note'>>) {
    const cur = entries.value[id] ?? { tags: [], note: '', updatedAt: '' }
    const next = { ...cur, ...patch, updatedAt: new Date().toISOString() }
    const copy = { ...entries.value }
    if (!next.tags.length && !next.note.trim()) delete copy[id]
    else copy[id] = next
    entries.value = copy
    clearTimeout(timer)
    timer = setTimeout(flush, SAVE_DELAY_MS)
  }

  function toggleTag(id: string, tag: string) {
    const tags = entries.value[id]?.tags ?? []
    set(id, { tags: tags.includes(tag) ? tags.filter((t) => t !== tag) : [...tags, tag] })
  }

  /** Nhãn gợi ý + mọi nhãn riêng đã dùng */
  const allTags = computed(() => {
    const used = new Set(Object.values(entries.value).flatMap((e) => e.tags))
    return [...PRESET_TAGS, ...[...used].filter((t) => !PRESET_TAGS.includes(t)).sort()]
  })

  return { entries, state, backend, saving, load, ensureLoaded, set, toggleTag, allTags }
})
