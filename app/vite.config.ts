import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { dashboardPasswordGuard } from './dashboard-password-guard'
import { mt5CandlesDevEndpoint, mt5ReportsDevEndpoint } from './local-folder-dev-endpoint'

export default defineConfig(({ mode }) => {
  // Đọc DASHBOARD_* từ app/.env (chỉ dùng phía dev server, không đưa xuống trình duyệt)
  const env = loadEnv(mode, process.cwd(), 'DASHBOARD_')
  const extraHosts = (env.DASHBOARD_ALLOWED_HOSTS ?? '').split(',').map((h) => h.trim()).filter(Boolean)
  return {
    // Thứ tự quan trọng: kiểm tra mật khẩu trước khi phục vụ bất kỳ file / báo cáo nào
    plugins: [
      dashboardPasswordGuard({ password: env.DASHBOARD_PASSWORD, user: env.DASHBOARD_USER }),
      vue(),
      mt5ReportsDevEndpoint(),
      mt5CandlesDevEndpoint(),
    ],
    server: {
      // Tên miền của Cloudflare quick tunnel; thêm tên miền riêng qua DASHBOARD_ALLOWED_HOSTS
      allowedHosts: ['.trycloudflare.com', ...extraHosts],
    },
  }
})
