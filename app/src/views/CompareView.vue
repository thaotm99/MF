<script setup lang="ts">
import AccountComparisonTable from '../components/AccountComparisonTable.vue'
import AnalysisPage from '../components/AnalysisPage.vue'
import { useDashboardData } from '../composables/use-dashboard-data'

const { comparison, display } = useDashboardData()
</script>

<template>
  <!-- So sánh luôn gồm mọi tài khoản → ẩn ô chọn tài khoản -->
  <AnalysisPage title="So sánh tài khoản" description="Mọi tài khoản, trong kỳ đã chọn. Bấm tiêu đề cột để sắp xếp." hide-account>
    <AccountComparisonTable :rows="comparison" :currency="display" />
  </AnalysisPage>
</template>
