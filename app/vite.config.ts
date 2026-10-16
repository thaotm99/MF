import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { mt5ReportsDevEndpoint } from './mt5-reports-dev-endpoint'

export default defineConfig({
  plugins: [vue(), mt5ReportsDevEndpoint()],
})
