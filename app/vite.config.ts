import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { exnessDevProxy } from './exness-dev-proxy'
import { mt5ReportsDevEndpoint } from './mt5-reports-dev-endpoint'

export default defineConfig({
  plugins: [vue(), exnessDevProxy(), mt5ReportsDevEndpoint()],
})
