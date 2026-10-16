<script setup lang="ts">
import { computed, onActivated, ref, watch } from 'vue'
import ClosedDeals from '../components/ClosedDeals.vue'
import DateRangePicker, { type DateRange } from '../components/DateRangePicker.vue'
import PnlCalendar from '../components/PnlCalendar.vue'
import SummaryPanel from '../components/SummaryPanel.vue'
import { useDashboardStore } from '../stores/dashboard'
import { useReportsStore } from '../stores/reports'
import { useSettingsStore } from '../stores/settings'
import { dailyPnl, dayKey, startOfDay, summarize } from '../utils/stats'

const settings = useSettingsStore()
const dash = useDashboardStore()
const reports = useReportsStore()

/** Tài khoản MT5 (từ báo cáo HTML) + tài khoản API; trùng số tài khoản thì dùng báo cáo. */
const dashboardAccounts = computed(() => {
  const mt5 = new Set(reports.entries.map((e) => e.accountId))
  return [...reports.entries, ...settings.credentials.filter((c) => !mt5.has(c.accountId))]
})


const selected = ref<'all' | string>('all')
const tab = ref<'daily' | 'closed' | 'chart'>('daily')
const now = ref(Date.now())

const [ty, tm] = dayKey(Date.now(), settings.timeZone).split('-').map(Number)
const calYear = ref(ty)
const calMonth = ref(tm - 1)

const keys = computed(() =>
  selected.value === 'all' ? dashboardAccounts.value.map((a) => a.id) : [selected.value],
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
const monthFrom = computed(() => startOfDay(calYear.value, calMonth.value, 1, settings.timeZone))

const deals = computed(() => dash.dealsOf(keys.value))
const summary = computed(() => summarize(deals.value, rangeFrom.value, rangeTo.value))
const daily = computed(() => dailyPnl(deals.value, settings.timeZone))

const accountRows = computed(() => keys.value.map((k) => ({ key: k, d: dash.data[k] })))
const equity = computed(() =>
  accountRows.value.reduce((s, r) => s + Number(r.d?.state?.equity ?? 0), 0),
)
const unrealized = computed(() =>
  accountRows.value.reduce((s, r) => s + Number(r.d?.state?.equity ?? 0) - Number(r.d?.state?.balance ?? 0), 0),
)
const currencies = computed(
  () => new Set(accountRows.value.map((r) => r.d?.details?.settings?.currency).filter(Boolean) as string[]),
)
const currency = computed(() => [...currencies.value][0] ?? 'USD')

const errors = computed(() =>
  accountRows.value
    .filter((r) => r.d?.error)
    .map((r) => ({ label: dashboardAccounts.value.find((a) => a.id === r.key)?.label ?? r.key, error: r.d!.error! })),
)
const clamped = computed(() => {
  const t = Math.max(0, ...accountRows.value.map((r) => r.d?.oldestAllowed ?? 0))
  return t > rangeFrom.value || t > monthFrom.value ? t : 0
})

function load(refreshState = false) {
  if (!keys.value.length) return
  now.value = Date.now()
  // Tải liên tục từ mốc sớm nhất (kỳ đã chọn hoặc tháng trên lịch) tới hiện tại
  dash.ensureRange(keys.value, Math.min(rangeFrom.value, monthFrom.value), now.value, refreshState)
}

function refresh() {
  dash.reset()
  load(true)
}

watch([keys, range, calYear, calMonth], () => load())
// Đọc lại báo cáo MT5 thì cập nhật số liệu
watch(() => reports.accounts, () => load())
watch(() => settings.mode, refresh)
watch(
  () => dashboardAccounts.value.map((a) => a.id),
  (ids) => {
    if (selected.value !== 'all' && !ids.includes(selected.value)) selected.value = 'all'
  },
)
// Trang được giữ trong <KeepAlive>: mỗi lần quay lại thì cập nhật snapshot và tải phần còn thiếu
onActivated(() => load(true))

function onCalendarChange(y: number, m: number) {
  calYear.value = y
  calMonth.value = m
}
</script>

<template>
  <main class="page">
    <header class="top">
      <h1>Tổng quan</h1>
      <RouterLink class="btn" to="/accounts">Quản lý tài khoản ({{ dashboardAccounts.length }})</RouterLink>
    </header>

    <section v-if="!dashboardAccounts.length" class="card empty">
      <p>Chưa có tài khoản nào. Thêm Account ID, API Key và Secret Key từ Key Management của Exness để bắt đầu.</p>
      <RouterLink class="btn btn-primary" to="/accounts">+ Thêm tài khoản</RouterLink>
    </section>

    <template v-else>
      <section class="card summary">
        <div class="filters">
          <label class="field">
            <span>Tài khoản</span>
            <select v-model="selected" class="select account">
              <option value="all">Tất cả tài khoản</option>
              <option v-for="a in dashboardAccounts" :key="a.id" :value="a.id">{{ a.label }} (#{{ a.accountId }})</option>
            </select>
          </label>
          <div class="field">
            <span>Thời gian</span>
            <DateRangePicker v-model="range" :today="today" />
          </div>
          <span v-if="dash.loading" class="loading">Đang tải…</span>
        </div>

        <p v-for="e in errors" :key="e.label" class="alert error"><b>{{ e.label }}:</b> {{ e.error }}</p>
        <p v-if="currencies.size > 1" class="alert">
          Các tài khoản dùng nhiều loại tiền ({{ [...currencies].join(', ') }}) — số tổng chỉ cộng gộp, không quy đổi.
          Hãy chọn từng tài khoản để xem chính xác.
        </p>
        <p v-if="clamped" class="alert">
          API chỉ cho phép xem lịch sử từ {{ new Date(clamped).toLocaleDateString('vi-VN') }} trở đi (history_age_days).
        </p>

        <SummaryPanel
          :summary="summary"
          :equity="equity"
          :unrealized="unrealized"
          :currency="currency"
          :loading="dash.loading"
        />
      </section>

      <h2 class="section-title">Nhật ký giao dịch</h2>
      <section class="card journal">
        <nav class="tabs">
          <button :class="{ active: tab === 'daily' }" @click="tab = 'daily'">PnL hàng ngày</button>
          <button :class="{ active: tab === 'closed' }" @click="tab = 'closed'">Các giao dịch đã đóng</button>
          <button :class="{ active: tab === 'chart' }" @click="tab = 'chart'">Biểu đồ</button>
        </nav>
        <div class="tab-body">
          <PnlCalendar
            v-if="tab === 'daily'"
            :year="calYear"
            :month="calMonth"
            :daily="daily"
            :time-zone="settings.timeZone"
            :loading="dash.loading"
            @change="onCalendarChange"
            @refresh="refresh"
          />
          <ClosedDeals
            v-else-if="tab === 'closed'"
            :deals="deals"
            :from="rangeFrom"
            :to="rangeTo"
            :show-account="keys.length > 1"
          />
          <p v-else class="soon">Biểu đồ sẽ được bổ sung ở phiên bản sau.</p>
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
