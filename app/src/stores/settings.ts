import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export type TimeZoneMode = 'utc' | 'local'

const KEY = 'exness-dashboard.settings.v3'

function load(): TimeZoneMode {
  try {
    // Bản cũ lưu API key / Secret Key trong localStorage → xoá đi, không còn dùng
    localStorage.removeItem('exness-dashboard.settings.v1')
    localStorage.removeItem('exness-dashboard.settings.v2')
    const v = localStorage.getItem(KEY)
    if (v === 'utc' || v === 'local') return v
  } catch {
    /* localStorage bị chặn */
  }
  return 'utc'
}

/** Tuỳ chọn hiển thị, lưu trong localStorage của trình duyệt. */
export const useSettingsStore = defineStore('settings', () => {
  const timeZone = ref<TimeZoneMode>(load())
  watch(timeZone, (v) => {
    try {
      localStorage.setItem(KEY, v)
    } catch {
      /* bỏ qua */
    }
  })
  return { timeZone }
})
