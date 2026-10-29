<script setup lang="ts">
import { useDashboardData } from '../composables/use-dashboard-data'
import DashboardFilters from './DashboardFilters.vue'
import { useReportsStore } from '../stores/reports'

/** Khung chung của trang phân tích: tiêu đề, thanh lọc, thông báo khi chưa có báo cáo */
defineProps<{ title: string; description?: string; hideAccount?: boolean; plain?: boolean }>()
const { hasAccounts, loading } = useDashboardData()
const reports = useReportsStore()
</script>

<template>
  <main class="page">
    <header class="head">
      <h1>{{ title }}</h1>
      <p v-if="description" class="desc">{{ description }}</p>
    </header>

    <section v-if="!hasAccounts" class="card empty">
      <p v-if="loading">Đang đọc báo cáo…</p>
      <p v-else-if="reports.source === 'browser'">
        Chưa có báo cáo nào. Xuất báo cáo HTML từ MT5 (History → Report → HTML) rồi nạp ở trang Báo cáo MT5 — file chỉ lưu trong trình duyệt này.
      </p>
      <p v-else>
        Chưa có báo cáo nào. Xuất báo cáo HTML từ MT5 (History → Report → HTML) vào thư mục <code>app/reports/</code> rồi tải lại.
      </p>
      <RouterLink class="btn btn-primary" to="/reports">{{ reports.source === 'browser' ? 'Nạp báo cáo' : 'Hướng dẫn' }}</RouterLink>
    </section>

    <template v-else>
      <DashboardFilters :hide-account="hideAccount" />
      <slot v-if="plain" />
      <section v-else class="card body"><slot /></section>
    </template>
  </main>
</template>

<style scoped>
.page { max-width: 1240px; margin: 0 auto; padding: 24px 24px 48px; }
.head { margin-bottom: 16px; }
h1 { font-size: 26px; font-weight: 600; margin: 0; }
.desc { color: var(--muted); font-size: 13px; margin: 4px 0 0; }
.card.body { padding: 16px; }
.empty { text-align: center; color: var(--muted); padding: 24px; }
@media (max-width: 640px) { .page { padding: 16px 16px 40px; } h1 { font-size: 22px; } }
</style>
