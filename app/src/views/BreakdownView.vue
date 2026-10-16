<script setup lang="ts">
import AnalysisPage from '../components/AnalysisPage.vue'
import PnlBreakdownCharts from '../components/PnlBreakdownCharts.vue'
import { useDashboardData } from '../composables/use-dashboard-data'
import { useSettingsStore } from '../stores/settings'

const settings = useSettingsStore()
const { positions, currency } = useDashboardData()
</script>

<template>
  <AnalysisPage title="Biểu đồ" description="Lãi/lỗ theo giờ vào lệnh, chiều, khối lượng, mã, ATR, ER5 và bản đồ nhiệt.">
    <PnlBreakdownCharts :positions="positions" :currency="currency" :time-zone="settings.timeZone" />
  </AnalysisPage>
</template>
