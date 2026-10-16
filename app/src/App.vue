<script setup lang="ts">
import { ref, watch } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import { touchNow } from './composables/use-dashboard-data'
import { useReportsStore } from './stores/reports'

const reports = useReportsStore()
const route = useRoute()

// Khi mở app và mỗi lần chuyển trang: đọc lại báo cáo MT5 trong app/reports/ (qua dev server)
reports.load()
const menuOpen = ref(false)
watch(
  () => route.path,
  (path, prev) => {
    menuOpen.value = false
    if (prev !== undefined && path !== '/reports') {
      touchNow()
      reports.load()
    }
  },
)

/** Menu sidebar theo nhóm; icon là SVG nét mảnh, kế thừa màu chữ */
const NAV = [
  { group: '', items: [{ to: '/', label: 'Tổng quan', icon: 'M3 12l9-8 9 8M5 10v10h5v-6h4v6h5V10' }] },
  {
    group: 'Phân tích',
    items: [
      { to: '/chart', label: 'Chart giá', icon: 'M7 4v16M17 4v16M4 8h6v8H4zM14 6h6v6h-6z' },
      { to: '/evaluation', label: 'Đánh giá lệnh', icon: 'M9 11l3 3 8-8M20 12v7a1 1 0 01-1 1H5a1 1 0 01-1-1V5a1 1 0 011-1h11' },
      { to: '/breakdown', label: 'Biểu đồ', icon: 'M4 20V10M10 20V4M16 20v-7M22 20H2' },
      { to: '/trades', label: 'Lệnh đã đóng', icon: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01' },
      { to: '/compare', label: 'So sánh tài khoản', icon: 'M3 3h7v18H3zM14 8h7v13h-7z' },
    ],
  },
  { group: 'Dữ liệu', items: [{ to: '/reports', label: 'Báo cáo MT5', icon: 'M14 3H6a1 1 0 00-1 1v16a1 1 0 001 1h12a1 1 0 001-1V8zM14 3v5h5M9 13h6M9 17h6' }] },
  { group: 'Tham khảo', items: [{ to: '/glossary', label: 'Thuật ngữ', icon: 'M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2zM4 5v16M8 7h7M8 11h7' }] },
]
</script>

<template>
  <div class="layout" :class="{ open: menuOpen }">
    <header class="mobile-bar">
      <button type="button" class="burger" :aria-expanded="menuOpen" aria-label="Mở menu" @click="menuOpen = !menuOpen">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M3 12h18M3 18h18" /></svg>
      </button>
      <span class="brand">Exness Dashboard</span>
    </header>

    <aside class="sidebar" aria-label="Menu chính">
      <div class="brand side-brand">Exness Dashboard</div>
      <nav>
        <div v-for="g in NAV" :key="g.group" class="group">
          <div v-if="g.group" class="group-title">{{ g.group }}</div>
          <RouterLink v-for="it in g.items" :key="it.to" :to="it.to" class="link"
            :exact-active-class="it.to === '/' ? 'active' : ''" :active-class="it.to === '/' ? '' : 'active'">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"
              stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path :d="it.icon" /></svg>
            <span>{{ it.label }}</span>
          </RouterLink>
        </div>
      </nav>
      <div class="side-foot">{{ reports.accounts.length }} tài khoản · {{ reports.files.length }} file báo cáo</div>
    </aside>
    <div class="scrim" @click="menuOpen = false" />

    <div class="content">
      <RouterView />
    </div>
  </div>
</template>

<style scoped>
.layout { display: grid; grid-template-columns: 232px minmax(0, 1fr); min-height: 100vh; }
.sidebar {
  position: sticky; top: 0; height: 100vh; overflow-y: auto; background: var(--surface);
  border-right: 1px solid var(--border); display: flex; flex-direction: column; padding: 18px 12px;
}
.brand { font-weight: 700; font-size: 15px; }
.side-brand { padding: 0 10px 18px; }
.group + .group { margin-top: 14px; }
.group-title { font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: var(--faint); padding: 0 10px 6px; }
.link {
  display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 6px; color: var(--muted);
  text-decoration: none; font-size: 14px;
}
.link:hover { background: #f4f5f7; color: var(--text); }
.link.active { background: #eaf2ff; color: var(--accent); font-weight: 600; }
.side-foot { margin-top: auto; padding: 12px 10px 0; font-size: 11px; color: var(--faint); }
.content { min-width: 0; }
.mobile-bar, .scrim { display: none; }

@media (max-width: 900px) {
  .layout { grid-template-columns: 1fr; }
  .mobile-bar {
    display: flex; align-items: center; gap: 10px; position: sticky; top: 0; z-index: 30;
    background: var(--surface); border-bottom: 1px solid var(--border); padding: 10px 16px;
  }
  .burger { border: 1px solid var(--border); background: var(--surface); border-radius: 6px; padding: 5px; display: flex; color: var(--text); }
  .sidebar {
    position: fixed; z-index: 40; left: 0; top: 0; width: 260px; transform: translateX(-100%);
    transition: transform .2s ease; box-shadow: 0 0 24px rgba(20, 29, 34, .15);
  }
  .open .sidebar { transform: none; }
  .open .scrim { display: block; position: fixed; inset: 0; z-index: 35; background: rgba(20, 29, 34, .3); }
}
</style>
