import { storeToRefs } from 'pinia'
import { computed, ref } from 'vue'
import { useFiltersStore } from '../stores/filters'
import { useReportsStore, type Mt5Account } from '../stores/reports'
import { useSettingsStore } from '../stores/settings'
import { compareAccount } from '../utils/account-comparison-stats'
import { conversionRate, convertDeal, dailyPnl, dayKey, startOfDay, summarize } from '../utils/stats'

/** Thời điểm "bây giờ" dùng chung — cập nhật khi đọc lại báo cáo */
const now = ref(Date.now())
export const touchNow = () => (now.value = Date.now())

/**
 * Dữ liệu đã lọc theo bộ lọc chung (tài khoản, kỳ) và quy đổi sang tiền tệ hiển thị.
 * Mọi trang phân tích dùng chung để số liệu luôn khớp nhau.
 */
export function useDashboardData() {
  const settings = useSettingsStore()
  const reports = useReportsStore()
  const filters = useFiltersStore()
  const { selected, range } = storeToRefs(filters)

  /** Tài khoản đang xem: tất cả hoặc một tài khoản */
  const accounts = computed(() =>
    selected.value === 'all' ? reports.accounts : reports.accounts.filter((a) => a.id === selected.value),
  )
  const today = computed(() => dayKey(now.value, settings.timeZone))

  const dayStart = (key: string, offset = 0) => {
    const [y, m, d] = key.split('-').map(Number)
    return startOfDay(y, m - 1, d + offset, settings.timeZone)
  }
  /** Kỳ đã chọn dạng [rangeFrom, rangeTo), không vượt quá hiện tại */
  const rangeFrom = computed(() => dayStart(range.value.start))
  const rangeTo = computed(() => Math.min(dayStart(range.value.end, 1), now.value + 1))

  /** Hệ số quy đổi từng tài khoản sang tiền tệ hiển thị; null = không quy đổi được (giữ nguyên) */
  const display = computed(() => settings.displayCurrency)
  const rateOf = (accountCurrency: string) => conversionRate(accountCurrency, display.value)

  /** Deal của một tài khoản, đã quy đổi tiền tệ */
  const convertedDeals = (a: Mt5Account) => {
    const f = rateOf(a.currency)
    return f === null ? a.deals : a.deals.map((d) => convertDeal(d, f, display.value))
  }
  const deals = computed(() => accounts.value.flatMap(convertedDeals))

  /** Vị thế đóng trong kỳ, đã quy đổi tiền tệ (bảng Positions của báo cáo) */
  const positions = computed(() =>
    accounts.value.flatMap((a) => {
      const f = rateOf(a.currency) ?? 1
      return a.positions
        .filter((p) => {
          const t = Date.parse(p.closeTime)
          return t >= rangeFrom.value && t < rangeTo.value
        })
        .map((p) => (f === 1 ? p : { ...p, netProfit: p.netProfit * f }))
    }),
  )

  const summary = computed(() => summarize(deals.value, rangeFrom.value, rangeTo.value))
  const daily = computed(() => dailyPnl(deals.value, settings.timeZone))

  /** Bảng so sánh: mọi tài khoản (không theo ô chọn tài khoản), trong kỳ đã chọn */
  const comparison = computed(() =>
    reports.accounts.map((a) =>
      compareAccount(
        {
          id: a.id,
          label: a.label,
          login: a.login,
          equity: (a.latest.equity ?? a.latest.balance ?? 0) * (rateOf(a.currency) ?? 1),
          openingBalance: a.openingBalance * (rateOf(a.currency) ?? 1),
        },
        convertedDeals(a),
        rangeFrom.value,
        rangeTo.value,
      ),
    ),
  )

  // Equity lấy từ phần tổng kết của báo cáo mới nhất mỗi tài khoản
  const equity = computed(() =>
    accounts.value.reduce((s, a) => s + (a.latest.equity ?? a.latest.balance ?? 0) * (rateOf(a.currency) ?? 1), 0),
  )
  /** Tài khoản có tiền tệ không quy đổi được sang USD/USC */
  const unconvertible = computed(() => [
    ...new Set(accounts.value.filter((a) => rateOf(a.currency) === null).map((a) => a.currency)),
  ])
  const currency = computed(() =>
    unconvertible.value.length && accounts.value.length === 1 ? unconvertible.value[0] : display.value,
  )
  const loading = computed(() => reports.state === 'loading')
  const hasAccounts = computed(() => reports.accounts.length > 0)

  return {
    accounts, today, rangeFrom, rangeTo, display, deals, positions, summary, daily, comparison,
    equity, unconvertible, currency, loading, hasAccounts,
  }
}
