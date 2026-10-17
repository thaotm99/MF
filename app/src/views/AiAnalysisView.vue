<script setup lang="ts">
import AiOverallAnalysis from '../components/AiOverallAnalysis.vue'
import AnalysisPage from '../components/AnalysisPage.vue'
</script>

<template>
  <AnalysisPage title="Phân tích AI" description="Claude Code trên máy này đọc toàn bộ lệnh trong kỳ + code bot và nhận xét định tính." plain>
    <AiOverallAnalysis />
  </AnalysisPage>
</template>
