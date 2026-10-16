import { createRouter, createWebHistory } from 'vue-router'
import OverviewView from './views/OverviewView.vue'

/** Mỗi chức năng một trang; `group` = nhóm trên sidebar */
export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'overview', component: OverviewView, meta: { title: 'Tổng quan' } },
    { path: '/chart', name: 'chart', component: () => import('./views/PriceChartView.vue'), meta: { title: 'Chart giá' } },
    { path: '/evaluation', name: 'evaluation', component: () => import('./views/EvaluationView.vue'), meta: { title: 'Đánh giá lệnh' } },
    { path: '/breakdown', name: 'breakdown', component: () => import('./views/BreakdownView.vue'), meta: { title: 'Biểu đồ' } },
    { path: '/trades', name: 'trades', component: () => import('./views/TradesView.vue'), meta: { title: 'Lệnh đã đóng' } },
    { path: '/compare', name: 'compare', component: () => import('./views/CompareView.vue'), meta: { title: 'So sánh tài khoản' } },
    { path: '/glossary', name: 'glossary', component: () => import('./views/GlossaryView.vue'), meta: { title: 'Thuật ngữ' } },
    { path: '/reports', name: 'reports', component: () => import('./views/ReportsView.vue'), meta: { title: 'Báo cáo MT5' } },
    { path: '/accounts', redirect: '/reports' },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
  // Link có #mục (ví dụ /glossary#trade): chờ trang lazy-load render xong rồi cuộn tới (chừa chỗ thanh tìm kiếm dính trên đầu)
  scrollBehavior(to, _from, saved) {
    if (saved) return saved
    if (to.hash) return new Promise((resolve) => setTimeout(() => resolve({ el: to.hash, top: 64 }), 250))
    return { top: 0 }
  },
})

router.afterEach((to) => {
  document.title = `${to.meta.title ?? ''} · Exness Dashboard`
})
