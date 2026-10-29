<script setup lang="ts">
import AiOverallAnalysis from '../components/AiOverallAnalysis.vue'
import AnalysisPage from '../components/AnalysisPage.vue'
import { AI_AVAILABLE } from '../api/ai-analysis-client'
</script>

<template>
  <AnalysisPage title="Phân tích AI" description="Claude Code trên máy này đọc toàn bộ lệnh trong kỳ + code bot và nhận xét định tính." plain>
    <AiOverallAnalysis v-if="AI_AVAILABLE" />
    <p v-else class="alert">
      Phân tích AI dùng Claude Code trên máy của bạn nên chỉ chạy khi mở dashboard bằng <code>npm run dev</code> trên máy đó —
      bản deploy (Vercel) không có chức năng này.
    </p>
  </AnalysisPage>
</template>
