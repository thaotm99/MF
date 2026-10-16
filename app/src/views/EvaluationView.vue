<script setup lang="ts">
import { defineAsyncComponent } from 'vue'
import { useRouter } from 'vue-router'
import type { CandleTimeframe } from '../api/mt5-candles-csv-parser'
import AnalysisPage from '../components/AnalysisPage.vue'
import { useDashboardData } from '../composables/use-dashboard-data'

const TradeEvaluationTab = defineAsyncComponent(() => import('../components/TradeEvaluationTab.vue'))
const { positions, currency } = useDashboardData()
const router = useRouter()

/** "Xem trên chart": sang trang Chart giá, zoom tới lệnh */
const showOnChart = (id: string, tf: CandleTimeframe) => router.push({ path: '/chart', query: { trade: id, tf } })
</script>

<template>
  <AnalysisPage title="Đánh giá lệnh" description="Bối cảnh price action lúc vào từng lệnh và thống kê thắng/thua theo từng yếu tố.">
    <TradeEvaluationTab :positions="positions" :currency="currency" @show="showOnChart" />
  </AnalysisPage>
</template>
