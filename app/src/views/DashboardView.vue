<script setup lang="ts">
import { computed, defineAsyncComponent, onActivated, ref, watch } from 'vue'
import ClosedDeals from '../components/ClosedDeals.vue'
import DateRangePicker, { type DateRange } from '../components/DateRangePicker.vue'
import PnlBreakdownCharts from '../components/PnlBreakdownCharts.vue'
import PnlCalendar from '../components/PnlCalendar.vue'
import SummaryPanel from '../components/SummaryPanel.vue'
import TradingExtremesStrip from '../components/TradingExtremesStrip.vue'
import { useReportsStore } from '../stores/reports'
import { useSettingsStore } from '../stores/settings'
import { conversionRate, convertDeal, dailyPnl, dayKey, startOfDay, summarize } from '../utils/stats'
import { dayExtremes, maxLosingStreak } from '../utils/trading-extremes-stats'

const settings = useSettingsStore()
// Thư viện chart nến (~150 KB) chỉ tải khi mở tab "Chart giá"
const TradePriceChart = defineAsyncComponent(() => import('../components/TradePriceChart.vue'))
const reports = useReportsStore()

const selected = ref<'all' | string>('all')
const tab = ref<'daily' | 'closed' | 'chart' | 'price'>('daily')
const now = ref(Date.now())

const [ty, tm] = dayKey(Date.now(), settings.timeZone).split('-').map(Number)
const calYear = ref(ty)
const calMonth = ref(tm - 1)

/** Tài khoản đang xem: tất cả hoặc một tài khoản */
const accounts = computed(() =>
  selected.value === 'all' ? reports.accounts : reports.accounts.filter((a) => a.id === selected.value),
)
const today = computed(() => dayKey(now.value, settings.timeZone))
const daysAgo = (n: number) => dayKey(Date.now() - n * 86_400_000, settings.timeZone)
// Mặc định: 30 ngày qua (tính cả hôm nay)
const range = ref<DateRange>({ start: daysAgo(29), end: daysAgo(0) })

const dayStart = (key: string, offset = 0) => {
  const [y, m, d] = key.split('-').map(Number)
  return startOfDay(y, m - 1, d + offset, settings.timeZone)
}
/** Kỳ đã chọn dạng [rangeFrom, rangeTo), không vượt quá hiện tại */
const rangeFrom = computed(() => dayStart(range.value.start))
const rangeTo = computed(() => Math.min(dayStart(range.value.end, 1), now.value + 1))

/** Hệ số quy đổi từng tài khoản sang tiền tệ hiển thị; tài khoản không quy đổi được giữ nguyên */
const display = computed(() => settings.displayCurrency)
const rateOf = (accountCurrency: string) => conversionRate(accountCurrency, display.value)

const deals = computed(() =>
  accounts.value.flatMap((a) => {
    const f = rateOf(a.currency)
    return f === null ? a.deals : a.deals.map((d) => convertDeal(d, f, display.value))
  }),
)
/** Vị thế đóng trong kỳ, đã quy đổi tiền tệ — cho tab Biểu đồ */
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
/** Hôm nay theo múi giờ đã chọn — luôn tính riêng, không theo kỳ đã chọn */
const todayStat = computed(() => daily.value.get(today.value) ?? { pnl: 0, trades: 0 })
const todayLabel = computed(() => today.value.slice(8, 10) + '/' + today.value.slice(5, 7))
// Ngày lãi / lỗ lớn nhất và chuỗi thua dài nhất — trong kỳ đã chọn
const extremes = computed(() => dayExtremes(daily.value, range.value.start, range.value.end))
const losingStreak = computed(() => maxLosingStreak(deals.value, rangeFrom.value, rangeTo.value))

// Balance / equity lấy từ phần tổng kết của báo cáo mới nhất mỗi tài khoản
const equity = computed(() =>
  accounts.value.reduce((s, a) => s + (a.latest.equity ?? a.latest.balance ?? 0) * (rateOf(a.currency) ?? 1), 0),
)
const unrealized = computed(() =>
  accounts.value.reduce((s, a) => s + (a.latest.floatingPnl ?? 0) * (rateOf(a.currency) ?? 1), 0),
)
/** Tài khoản có tiền tệ không quy đổi được sang USD/USC */
const unconvertible = computed(() => [...new Set(accounts.value.filter((a) => rateOf(a.currency) === null).map((a) => a.currency))])
const currencies = computed(() => new Set([display.value, ...unconvertible.value]))
const currency = computed(() => (unconvertible.value.length && accounts.value.length === 1 ? unconvertible.value[0] : display.value))
const loading = computed(() => reports.state === 'loading')
const fileErrors = computed(() => reports.files.filter((f) => f.error))
/** Thời điểm xuất báo cáo cũ nhất trong các tài khoản đang xem — số liệu chỉ mới đến lúc đó */
const reportTime = computed(() =>
  accounts.value.map((a) => a.latest.reportTime).filter(Boolean).sort()[0],
)

watch(
  () => reports.accounts.map((a) => a.id),
  (ids) => {
    if (selected.value !== 'all' && !ids.includes(selected.value)) selected.value = 'all'
  },
)

function refresh() {
  now.value = Date.now()
  reports.load()
}
// Trang được giữ trong <KeepAlive>: mỗi lần quay lại thì đọc lại báo cáo
onActivated(refresh)

function onCalendarChange(y: number, m: number) {
  calYear.value = y
  calMonth.value = m
}

const fmtTime = (iso: string) => iso.slice(0, 16).replace('T', ' ')
</script>

<template>
  <main class="page">
    <header class="top">
      <h1>Tổng quan</h1>
      <RouterLink class="btn" to="/reports">Báo cáo MT5 ({{ reports.accounts.length }})</RouterLink>
    </header>

    <section v-if="!reports.accounts.length" class="card empty">
      <p v-if="loading">Đang đọc báo cáo…</p>
      <p v-else>
        Chưa có báo cáo nào. Xuất báo cáo HTML từ MT5 (History → Report → HTML) vào thư mục
        <code>app/reports/</code> rồi tải lại.
      </p>
      <RouterLink class="btn btn-primary" to="/reports">Hướng dẫn</RouterLink>
    </section>

    <template v-else>
      <section class="card summary">
        <div class="filters">
          <label class="field">
            <span>Tài khoản</span>
            <select v-model="selected" class="select account">
              <option value="all">Tất cả tài khoản</option>
              <option v-for="a in reports.accounts" :key="a.id" :value="a.id">{{ a.label }} (#{{ a.login }})</option>
            </select>
          </label>
          <div class="field">
            <span>Thời gian</span>
            <DateRangePicker v-model="range" :today="today" />
          </div>
          <div class="field">
            <span>Tiền tệ</span>
            <div class="seg" role="radiogroup" aria-label="Tiền tệ hiển thị">
              <button v-for="c in (['USD', 'USC'] as const)" :key="c" type="button" role="radio"
                :aria-checked="settings.displayCurrency === c" :class="{ on: settings.displayCurrency === c }"
                @click="settings.displayCurrency = c">{{ c }}</button>
            </div>
          </div>
          <span v-if="loading" class="loading">Đang đọc báo cáo…</span>
          <span v-else-if="reportTime" class="loading">Số liệu đến {{ fmtTime(reportTime) }} (giờ server)</span>
        </div>

        <p v-for="f in fileErrors" :key="f.name" class="alert error"><b>{{ f.name }}:</b> {{ f.error }}</p>
        <p v-if="currencies.size > 1" class="alert">
          Tài khoản dùng {{ unconvertible.join(', ') }} không quy đổi được sang {{ display }} — số tổng chỉ cộng gộp.
          Hãy chọn từng tài khoản để xem chính xác.
        </p>

        <SummaryPanel
          :summary="summary"
          :equity="equity"
          :unrealized="unrealized"
          :currency="currency"
          :loading="loading"
          :today-pnl="todayStat.pnl"
          :today-trades="todayStat.trades"
          :today-label="todayLabel"
        />
        <TradingExtremesStrip
          :best="extremes.best"
          :worst="extremes.worst"
          :streak="losingStreak"
          :currency="currency"
          :loading="loading"
        />
      </section>

      <h2 class="section-title">Nhật ký giao dịch</h2>
      <section class="card journal">
        <nav class="tabs">
          <button :class="{ active: tab === 'daily' }" @click="tab = 'daily'">PnL hàng ngày</button>
          <button :class="{ active: tab === 'closed' }" @click="tab = 'closed'">Các giao dịch đã đóng</button>
          <button :class="{ active: tab === 'chart' }" @click="tab = 'chart'">Biểu đồ</button>
          <button :class="{ active: tab === 'price' }" @click="tab = 'price'">Chart giá</button>
        </nav>
        <div class="tab-body">
          <PnlCalendar
            v-if="tab === 'daily'"
            :year="calYear"
            :month="calMonth"
            :daily="daily"
            :time-zone="settings.timeZone"
            :currency="currency === 'USD' ? '$' : currency"
            :loading="loading"
            @change="onCalendarChange"
            @refresh="refresh"
          />
          <ClosedDeals
            v-else-if="tab === 'closed'"
            :deals="deals"
            :from="rangeFrom"
            :to="rangeTo"
            :show-account="accounts.length > 1"
          />
          <PnlBreakdownCharts v-else-if="tab === 'chart'" :positions="positions" :currency="currency" :time-zone="settings.timeZone" />
          <TradePriceChart v-else :positions="positions" :currency="currency" :from="rangeFrom" :to="rangeTo" />
        </div>
      </section>
    </template>

  </main>
</template>

<style scoped>
.page { max-width: 1200px; margin: 0 auto; padding: 24px 16px 48px; }
.top { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 16px; }
h1 { font-size: 32px; font-weight: 600; margin: 0; }
.card { padding: 24px; }
.empty { text-align: center; color: var(--muted); }
.filters { display: flex; gap: 16px; align-items: flex-end; flex-wrap: wrap; margin-bottom: 28px; }
.filters .field { display: grid; gap: 6px; font-size: 12px; color: var(--text); }
.filters .field:first-child { width: min(370px, 100%); }
.account { width: 100%; }
.seg { display: inline-flex; border: 1px solid var(--border); border-radius: 6px; overflow: hidden; min-height: 40px; }
.seg button { border: 0; background: var(--surface); padding: 0 16px; color: var(--muted); font-weight: 500; }
.seg button + button { border-left: 1px solid var(--border); }
.seg button.on { background: var(--accent); color: #fff; }
.loading { color: var(--muted); font-size: 13px; padding-bottom: 10px; }
.section-title { font-size: 15px; font-weight: 600; margin: 28px 0 10px; }
.journal { padding: 0; }
.tabs { display: flex; gap: 4px; border-bottom: 1px solid var(--border); padding: 0 12px; overflow-x: auto; }
.tabs button {
  border: 0; background: none; padding: 12px; color: var(--muted); font-size: 13px;
  border-bottom: 2px solid transparent; white-space: nowrap;
}
.tabs button.active { color: var(--accent); border-bottom-color: var(--accent); }
.tab-body { padding: 16px; }
.soon { color: var(--muted); text-align: center; padding: 40px 0; }
@media (max-width: 520px) { h1 { font-size: 24px; } .card { padding: 16px; } }
</style>
