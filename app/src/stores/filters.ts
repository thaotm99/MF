import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import type { DateRange } from '../components/DateRangePicker.vue'
import { dayKey } from '../utils/stats'
import { useReportsStore } from './reports'
import { useSettingsStore } from './settings'

/**
 * Bộ lọc dùng chung cho mọi trang phân tích (giữ nguyên khi chuyển trang trên sidebar):
 * tài khoản đang xem, khoảng thời gian, tháng đang xem trên lịch PnL.
 */
export const useFiltersStore = defineStore('filters', () => {
  const settings = useSettingsStore()
  const reports = useReportsStore()

  /** Mặc định: tài khoản đầu tiên ("all" = cộng gộp mọi tài khoản) */
  const selected = ref<'all' | string>('')
  watch(
    () => reports.accounts.map((a) => a.id),
    (ids) => {
      if (selected.value === 'all' || ids.includes(selected.value)) return
      selected.value = ids[0] ?? ''
    },
    { immediate: true },
  )

  const daysAgo = (n: number) => dayKey(Date.now() - n * 86_400_000, settings.timeZone)
  /** Mặc định: 30 ngày qua (tính cả hôm nay) */
  const range = ref<DateRange>({ start: daysAgo(29), end: daysAgo(0) })

  const [y, m] = dayKey(Date.now(), settings.timeZone).split('-').map(Number)
  const calYear = ref(y)
  const calMonth = ref(m - 1)

  return { selected, range, calYear, calMonth }
})
