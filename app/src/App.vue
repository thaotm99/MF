<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
import { useReportsStore } from './stores/reports'

// Khi mở app: đọc các báo cáo MT5 trong app/reports/ (qua dev server)
useReportsStore().load()
</script>

<template>
  <nav class="topnav">
    <div class="inner">
      <span class="brand">Exness Dashboard</span>
      <RouterLink to="/" class="link" exact-active-class="active">Tổng quan</RouterLink>
      <RouterLink to="/reports" class="link" active-class="active">Báo cáo MT5</RouterLink>
    </div>
  </nav>
  <RouterView v-slot="{ Component }">
    <KeepAlive include="DashboardView">
      <component :is="Component" />
    </KeepAlive>
  </RouterView>
</template>

<style scoped>
.topnav { background: var(--surface); border-bottom: 1px solid var(--border); }
.inner { max-width: 1200px; margin: 0 auto; padding: 0 16px; display: flex; align-items: center; gap: 4px; overflow-x: auto; }
.brand { font-weight: 700; margin-right: 20px; white-space: nowrap; }
.link {
  padding: 16px 12px 14px; color: var(--muted); text-decoration: none; font-size: 14px;
  border-bottom: 2px solid transparent; white-space: nowrap;
}
.link:hover { color: var(--text); }
.link.active { color: var(--accent); border-bottom-color: var(--accent); }
</style>
