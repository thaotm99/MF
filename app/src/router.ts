import { createRouter, createWebHistory } from 'vue-router'
import DashboardView from './views/DashboardView.vue'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'dashboard', component: DashboardView, meta: { title: 'Tổng quan' } },
    {
      path: '/reports',
      name: 'reports',
      component: () => import('./views/ReportsView.vue'),
      meta: { title: 'Báo cáo MT5' },
    },
    { path: '/accounts', redirect: '/reports' },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

router.afterEach((to) => {
  document.title = `${to.meta.title ?? ''} · Exness Dashboard`
})
