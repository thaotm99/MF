<script setup lang="ts">
import Mt5ReportsPanel from '../components/Mt5ReportsPanel.vue'
import { useSettingsStore } from '../stores/settings'

const settings = useSettingsStore()
</script>

<template>
  <main class="page">
    <h1>Báo cáo MT5</h1>

    <Mt5ReportsPanel />

    <section class="card block">
      <h2>Cài đặt</h2>
      <h3>Múi giờ cho lịch PnL</h3>
      <label class="check"><input v-model="settings.timeZone" type="radio" value="utc" /> Giờ server MT5 (UTC+0)</label>
      <label class="check"><input v-model="settings.timeZone" type="radio" value="local" /> Giờ máy của bạn</label>
    </section>
  </main>
</template>

<style scoped>
.page { max-width: 1200px; margin: 0 auto; padding: 24px 16px 48px; }
h1 { font-size: 32px; font-weight: 600; margin: 0 0 8px; }
h2 { font-size: 17px; margin: 0; }
h3 { font-size: 14px; margin: 14px 0 8px; }
.block { padding: 20px 24px; margin-top: 16px; }
label.check { display: flex; gap: 8px; align-items: center; font-size: 13px; margin: 4px 0; }
@media (max-width: 520px) { h1 { font-size: 24px; } .block { padding: 16px; } }
</style>
