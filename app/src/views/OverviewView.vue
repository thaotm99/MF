<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import AnalysisPage from '../components/AnalysisPage.vue'
import PnlCalendar from '../components/PnlCalendar.vue'
import SummaryPanel from '../components/SummaryPanel.vue'
import TradingExtremesStrip from '../components/TradingExtremesStrip.vue'
import { touchNow, useDashboardData } from '../composables/use-dashboard-data'
import { useFiltersStore } from '../stores/filters'
import { useReportsStore } from '../stores/reports'
import { useSettingsStore } from '../stores/settings'
import { dayExtremes, maxLosingStreak } from '../utils/trading-extremes-stats'

/** Trang Tổng quan: số liệu tổng của kỳ, ngày lãi/lỗ lớn nhất, chuỗi thua, lịch PnL hàng ngày */
const settings = useSettingsStore()
const reports = useReportsStore()
const { range, calYear, calMonth } = storeToRefs(useFiltersStore())
const { summary, equity, currency, loading, daily, today, deals, rangeFrom, rangeTo } = useDashboardData()

/** Hôm nay theo múi giờ đã chọn — luôn tính riêng, không theo kỳ đã chọn */
const todayStat = computed(() => daily.value.get(today.value) ?? { pnl: 0, trades: 0 })
const todayLabel = computed(() => today.value.slice(8, 10) + '/' + today.value.slice(5, 7))
const extremes = computed(() => dayExtremes(daily.value, range.value.start, range.value.end))
const losingStreak = computed(() => maxLosingStreak(deals.value, rangeFrom.value, rangeTo.value))

function refresh() {
  touchNow()
  reports.load()
}
function onCalendarChange(y: number, m: number) {
  calYear.value = y
  calMonth.value = m
}
</script>

<template>
  <AnalysisPage title="Tổng quan" plain>
    <section class="card block">
      <SummaryPanel :summary="summary" :equity="equity" :currency="currency" :loading="loading"
        :today-pnl="todayStat.pnl" :today-trades="todayStat.trades" :today-label="todayLabel" />
      <TradingExtremesStrip :best="extremes.best" :worst="extremes.worst" :streak="losingStreak" :currency="currency" :loading="loading" />
    </section>

    <h2 class="section-title">PnL hàng ngày</h2>
    <section class="card block">
      <PnlCalendar :year="calYear" :month="calMonth" :daily="daily" :time-zone="settings.timeZone"
        :currency="currency === 'USD' ? '$' : currency" :loading="loading" @change="onCalendarChange" @refresh="refresh" />
    </section>
  </AnalysisPage>
</template>

<style scoped>
.block { padding: 20px 24px; }
.section-title { font-size: 15px; font-weight: 600; margin: 24px 0 10px; }
@media (max-width: 520px) { .block { padding: 16px; } }
</style>
