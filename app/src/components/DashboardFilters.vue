<script setup lang="ts">
import { storeToRefs } from 'pinia'
import DateRangePicker from './DateRangePicker.vue'
import { useDashboardData } from '../composables/use-dashboard-data'
import { useFiltersStore } from '../stores/filters'
import { useReportsStore } from '../stores/reports'

/** Thanh lọc dùng chung: tài khoản + khoảng thời gian (giữ nguyên khi chuyển trang) */
defineProps<{ hideAccount?: boolean }>()
const reports = useReportsStore()
const { selected, range } = storeToRefs(useFiltersStore())
const { today, loading, unconvertible, display } = useDashboardData()
</script>

<template>
  <div class="filters">
    <label v-if="!hideAccount" class="field account-field">
      <span>Tài khoản</span>
      <select v-model="selected" class="select">
        <option value="all">Tất cả tài khoản</option>
        <option v-for="a in reports.accounts" :key="a.id" :value="a.id">{{ a.label }} (#{{ a.login }})</option>
      </select>
    </label>
    <div class="field">
      <span>Thời gian</span>
      <DateRangePicker v-model="range" :today="today" />
    </div>
    <span v-if="loading" class="loading">Đang đọc báo cáo…</span>
  </div>
  <p v-for="f in reports.files.filter((x) => x.error)" :key="f.name" class="alert error"><b>{{ f.name }}:</b> {{ f.error }}</p>
  <p v-if="unconvertible.length" class="alert">
    Tài khoản dùng {{ unconvertible.join(', ') }} không quy đổi được sang {{ display }} — số tổng chỉ cộng gộp.
    Hãy chọn từng tài khoản để xem chính xác.
  </p>
</template>

<style scoped>
.filters { display: flex; gap: 16px; align-items: flex-end; flex-wrap: wrap; margin-bottom: 16px; }
.field { display: grid; gap: 6px; font-size: 12px; color: var(--text); }
.account-field { width: min(370px, 100%); }
.account-field .select { width: 100%; }
.loading { color: var(--muted); font-size: 13px; padding-bottom: 10px; }
</style>
