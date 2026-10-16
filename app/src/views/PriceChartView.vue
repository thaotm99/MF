<script setup lang="ts">
import { computed, defineAsyncComponent } from 'vue'
import { useRoute } from 'vue-router'
import type { CandleTimeframe } from '../api/mt5-candles-csv-parser'
import AnalysisPage from '../components/AnalysisPage.vue'
import { useDashboardData } from '../composables/use-dashboard-data'

// Thư viện chart nến (~150 KB) chỉ tải khi mở trang này
const TradePriceChart = defineAsyncComponent(() => import('../components/TradePriceChart.vue'))
const { positions, currency, rangeFrom, rangeTo } = useDashboardData()

/** /chart?trade=<id>&tf=M15 — mở từ trang Đánh giá lệnh, zoom thẳng tới lệnh */
const route = useRoute()
const focusId = computed(() => (typeof route.query.trade === 'string' ? route.query.trade : undefined))
const focusTf = computed(() => (typeof route.query.tf === 'string' ? (route.query.tf as CandleTimeframe) : undefined))
</script>

<template>
  <AnalysisPage title="Chart giá" description="Nến từ app/candles/ và điểm vào/ra của các lệnh đóng trong kỳ.">
    <TradePriceChart :key="focusId ?? 'chart'" :positions="positions" :currency="currency" :from="rangeFrom" :to="rangeTo"
      :focus-id="focusId" :focus-timeframe="focusTf" />
  </AnalysisPage>
</template>
