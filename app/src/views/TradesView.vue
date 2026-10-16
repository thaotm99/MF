<script setup lang="ts">
import AnalysisPage from '../components/AnalysisPage.vue'
import ClosedDeals from '../components/ClosedDeals.vue'
import { useDashboardData } from '../composables/use-dashboard-data'

const { deals, rangeFrom, rangeTo, accounts } = useDashboardData()
</script>

<template>
  <AnalysisPage title="Lệnh đã đóng">
    <ClosedDeals :deals="deals" :from="rangeFrom" :to="rangeTo" :show-account="accounts.length > 1" />
  </AnalysisPage>
</template>
