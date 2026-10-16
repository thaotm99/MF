import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export type TimeZoneMode = 'utc' | 'local'
/** Tiền tệ hiển thị trên dashboard; 1 USD = 100 USC (tài khoản cent) */
export type DisplayCurrency = 'USD' | 'USC'

const TZ_KEY = 'exness-dashboard.settings.v3'
const CURRENCY_KEY = 'exness-dashboard.currency'

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null // localStorage bị chặn
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* bỏ qua */
  }
}

function cleanupLegacy() {
  try {
    // Bản cũ lưu API key / Secret Key trong localStorage → xoá đi, không còn dùng
    localStorage.removeItem('exness-dashboard.settings.v1')
    localStorage.removeItem('exness-dashboard.settings.v2')
  } catch {
    /* bỏ qua */
  }
}

/** Tuỳ chọn hiển thị, lưu trong localStorage của trình duyệt. */
export const useSettingsStore = defineStore('settings', () => {
  cleanupLegacy()
  const tz = read(TZ_KEY)
  const timeZone = ref<TimeZoneMode>(tz === 'local' ? 'local' : 'utc')
  // Mặc định USD
  const displayCurrency = ref<DisplayCurrency>(read(CURRENCY_KEY) === 'USC' ? 'USC' : 'USD')

  watch(timeZone, (v) => write(TZ_KEY, v))
  watch(displayCurrency, (v) => write(CURRENCY_KEY, v))

  return { timeZone, displayCurrency }
})
