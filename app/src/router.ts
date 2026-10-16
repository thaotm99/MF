import { createRouter, createWebHistory } from 'vue-router'
import DashboardView from './views/DashboardView.vue'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'dashboard', component: DashboardView, meta: { title: 'Tổng quan' } },
    {
      path: '/accounts',
      name: 'accounts',
      component: () => import('./views/AccountsView.vue'),
      meta: { title: 'Quản lý tài khoản' },
    },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

router.afterEach((to) => {
  document.title = `${to.meta.title ?? ''} · Exness Dashboard`
})
